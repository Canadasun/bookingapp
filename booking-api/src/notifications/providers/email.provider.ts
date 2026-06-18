import { Resend } from 'resend';
import { Logger } from '@nestjs/common';

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local.slice(0, 2)}***@${domain}`;
}

function htmlEsc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export interface EmailAttachment {
  filename: string;
  content: string; // base64-encoded
  content_type: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<void>;
}

export class ResendEmailProvider implements EmailProvider {
  private readonly logger = new Logger(ResendEmailProvider.name);

  async send(payload: EmailPayload): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || apiKey.startsWith('re_placeholder')) {
      this.logger.debug(`[Email stub] to: ${maskEmail(payload.to)} subject: ${payload.subject}`);
      return;
    }

    const verifiedFrom  = process.env.RESEND_VERIFIED_FROM;      // noreply@pulseappointments.com (once DNS verified)
    const sharedFrom    = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
    const testRedirect  = process.env.RESEND_TEST_REDIRECT === 'true';
    const adminEmail    = process.env.ADMIN_ALERT_EMAIL;

    // Use verified domain if available, otherwise fall back to shared domain
    const fromEmail = verifiedFrom ?? sharedFrom;
    const usingSharedDomain = fromEmail.endsWith('@resend.dev');

    // Redirect to admin when using shared domain + test mode enabled
    const shouldRedirect = usingSharedDomain && testRedirect && !!adminEmail;
    const actualTo = shouldRedirect ? adminEmail! : payload.to;

    const redirectBanner = shouldRedirect
      ? `<tr><td style="padding:8px 32px;background:#FEF3C7;border-bottom:2px dashed #F59E0B">
          <p style="margin:0;font-size:12px;font-weight:700;color:#92400E">⚠️ TEST REDIRECT — real recipient: <span style="color:#1D4ED8">${htmlEsc(payload.to)}</span></p>
          <p style="margin:2px 0 0;font-size:11px;color:#78350F">Domain pulseappointments.com DNS pending — verify it in Resend to send directly.</p>
         </td></tr>`
      : '';

    const finalHtml = redirectBanner
      ? payload.html.replace(/(<table[^>]*>[\s\S]*?)(<tr><td style="background:#E9A23C)/, (_m, p1, p2) => `${p1}${redirectBanner}${p2}`)
      : payload.html;

    const resend = new Resend(apiKey);

    const attempt = async (from: string, to: string, subject: string, html: string) => {
      const result = await resend.emails.send({ from, to, subject, html, ...(payload.attachments?.length ? { attachments: payload.attachments } : {}) });
      if (result.error) throw new Error(result.error.message);
      return result.data?.id;
    };

    try {
      const id = await attempt(
        fromEmail,
        actualTo,
        shouldRedirect ? `[→ ${payload.to}] ${payload.subject}` : payload.subject,
        finalHtml,
      );
      this.logger.log(`[Email sent] id=${id} from=${fromEmail} to=${maskEmail(actualTo)}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      // Domain not yet verified — fall back to shared domain + admin redirect so emails
      // don't silently drop while DNS is propagating.
      const isDomainError = msg.toLowerCase().includes('domain') ||
        msg.toLowerCase().includes('not verified') ||
        msg.toLowerCase().includes('validation_error') ||
        msg.toLowerCase().includes('testing emails to your own email address');

      if (verifiedFrom && isDomainError && adminEmail) {
        this.logger.warn(`[Email fallback] ${verifiedFrom} not yet verified — redirecting to admin`);
        try {
          const dnsBanner = `<tr><td style="padding:8px 32px;background:#FEF3C7"><p style="margin:0;font-size:12px;font-weight:700;color:#92400E">⚠️ DNS PENDING — would go to: ${htmlEsc(payload.to)}</p></td></tr>`;
          const id = await attempt(
            sharedFrom,
            adminEmail,
            `[DNS PENDING → ${payload.to}] ${payload.subject}`,
            payload.html.replace(
              /(<table[^>]*>[\s\S]*?)(<tr><td style="background:#E9A23C)/,
              (_m, p1, p2) => `${p1}${dnsBanner}${p2}`,
            ),
          );
          this.logger.log(`[Email fallback sent] id=${id} to=${maskEmail(adminEmail)} (intended: ${maskEmail(payload.to)})`);
        } catch (fallbackErr) {
          this.logger.error('[Email fallback also failed]', fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr));
          throw fallbackErr;
        }
      } else {
        this.logger.error('[Resend Error]', msg);
        throw err;
      }
    }
  }
}
