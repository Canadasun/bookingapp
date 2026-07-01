import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ResendEmailProvider } from './providers/email.provider';
import { TwilioSmsProvider } from './providers/sms.provider';
import { NOTIFICATION_QUEUE } from './notifications.service';
import { effectivePlan } from '../common/util/plan';
import { isProPlan } from '../common/util/plan-features';
import { signAppointmentToken } from '../common/util/appointment-token';
import { formatInTimeZone } from 'date-fns-tz';
import { generateICalEvent, generateICalCancellation } from '../calendar-sync/ical.util';
import { EventsGateway } from '../events/events.gateway';

// Escape user-controlled text before interpolating into email HTML — prevents
// HTML/markup injection via names, reasons, notes, gift-card messages, etc.
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

// Signs a one-click unsubscribe token for a client. Verified by NotificationsController.
export function signUnsubscribeToken(clientId: string, secret: string): string {
  return createHmac('sha256', secret).update(`unsub:${clientId}`).digest('hex');
}

export function verifyUnsubscribeToken(clientId: string, sig: string, secret: string): boolean {
  try {
    const expected = Buffer.from(signUnsubscribeToken(clientId, secret), 'hex');
    const provided  = Buffer.from(sig, 'hex');
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}

function emailWrap(content: string, unsubscribeUrl?: string, locale: 'en' | 'fr' = 'en') {
  const footerLink = unsubscribeUrl
    ? `<a href="${unsubscribeUrl}" style="color:#E9A23C;text-decoration:none">${locale === 'fr' ? 'Se désabonner' : 'Unsubscribe'}</a>`
    : locale === 'fr' ? 'Gérer les préférences' : 'Manage preferences';
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse</title></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden">
  <tr><td style="background:#E9A23C;padding:24px 32px">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px">Pulse</p>
  </td></tr>
  <tr><td style="padding:32px">${content}</td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #F3F4F6;background:#FAFAFA">
    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center">© Pulse · ${footerLink}</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// Inline "Verified" pill for emails (solid colour — gradients are unreliable in
// mail clients). Empty string unless the business is admin-approved.
function verifiedPill(status?: string | null) {
  if (status !== 'VERIFIED') return '';
  return ` <span style="display:inline-block;background:#4F46E5;color:#fff;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;vertical-align:middle">&#10003; Verified</span>`;
}

// Plain-text "where to meet" line for SMS / calendar, mode-aware. Returns '' for
// a plain in-person appointment with no address on file.
function whereText(apt: {
  locationMode?: string | null; meetingUrl?: string | null; customerAddress?: string | null;
  location?: { name?: string; address?: string | null } | null;
  business?: { address?: string | null } | null; locale?: string | null;
}): string {
  const fr = apt.locale === 'fr';
  switch (apt.locationMode) {
    case 'VIRTUAL':
      return apt.meetingUrl ? `${fr ? 'Appel vidéo' : 'Online video call'}: ${apt.meetingUrl}` : fr ? 'Appel vidéo — lien à venir' : 'Online video call — link to follow';
    case 'CUSTOMER':
      return apt.customerAddress ? `${fr ? 'Nous nous déplaçons chez vous' : 'We come to you'}: ${apt.customerAddress}` : fr ? 'Nous nous déplaçons chez vous' : 'We come to you';
    case 'PHONE':
      return fr ? 'Appel téléphonique — nous vous appellerons' : "Phone call — we'll call you";
    default: {
      const addr = apt.location?.address ?? apt.business?.address ?? '';
      return addr ? `${fr ? 'Lieu' : 'Location'}: ${addr}` : '';
    }
  }
}

function aptDetails(apt: {
  service: { name: string; durationMinutes: number };
  staff: { user: { name: string } };
  business: { name?: string; timezone?: string | null; verificationStatus?: string | null; address?: string | null };
  location?: { name?: string; address?: string | null } | null;
  locationMode?: string | null; meetingUrl?: string | null; customerAddress?: string | null;
  startsAt: Date; endsAt: Date;
  locale?: string | null;
}) {
  const fr = apt.locale === 'fr';
  const tz = apt.business.timezone ?? 'UTC';
  const bizRow = apt.business.name
    ? `<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">${fr ? 'Entreprise' : 'Business'}</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.business.name)}${verifiedPill(apt.business.verificationStatus)}</td></tr>`
    : '';
  // Mode-aware "Where" row. Virtual links are rendered as a clickable anchor;
  // everything else is escaped plain text.
  let whereValue = '';
  if (apt.locationMode === 'VIRTUAL') {
    whereValue = apt.meetingUrl
      ? `<a href="${esc(apt.meetingUrl)}" style="color:#4F46E5;font-weight:600">${fr ? 'Participer à l’appel vidéo' : 'Join video call'}</a>`
      : fr ? 'Appel vidéo — lien à venir' : 'Online video call — link to follow';
  } else if (apt.locationMode === 'CUSTOMER') {
    whereValue = apt.customerAddress ? `${fr ? 'Nous nous déplaçons chez vous' : 'We come to you'} — ${esc(apt.customerAddress)}` : fr ? 'Nous nous déplaçons chez vous' : 'We come to you';
  } else if (apt.locationMode === 'PHONE') {
    whereValue = fr ? 'Appel téléphonique — nous vous appellerons' : "Phone call — we'll call you";
  } else {
    const addr = apt.location?.address ?? apt.business.address ?? '';
    whereValue = addr ? esc(addr) : '';
  }
  const whereRow = whereValue
    ? `<tr><td style="padding:4px 0;color:#6B7280;font-size:13px">${fr ? 'Lieu' : 'Where'}</td><td style="color:#111827;font-size:13px;font-weight:600">${whereValue}</td></tr>`
    : '';
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#F8F9FA;border-radius:12px">
  <tr><td style="padding:16px 20px">
    <table width="100%">
      ${bizRow}
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Service</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.service.name)} (${apt.service.durationMinutes} min)</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">${fr ? 'Avec' : 'With'}</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.staff.user.name)}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Date</td><td style="color:#111827;font-size:13px;font-weight:600">${formatInTimeZone(apt.startsAt, tz, fr ? 'yyyy-MM-dd' : 'EEEE, MMMM d, yyyy')}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">${fr ? 'Heure' : 'Time'}</td><td style="color:#111827;font-size:13px;font-weight:600">${formatInTimeZone(apt.startsAt, tz, fr ? 'HH:mm' : 'h:mm a')} - ${formatInTimeZone(apt.endsAt, tz, fr ? 'HH:mm' : 'h:mm a')}</td></tr>
      ${whereRow}
    </table>
  </td></tr>
</table>`;
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

function aptDate(apt: { startsAt: Date; business: { timezone?: string | null } }, pattern: string) {
  return formatInTimeZone(apt.startsAt, apt.business.timezone ?? 'UTC', pattern);
}

type NotificationKey =
  | 'emailConfirmation'
  | 'emailReminder72h'
  | 'emailReminder24h'
  | 'emailFollowUp'
  | 'emailCancellation'
  | 'emailReschedule'
  | 'emailStaffCancellation'
  | 'smsConfirmation'
  | 'smsReminder2h';

function notificationEnabled(settings: unknown, key: NotificationKey) {
  return !settings || typeof settings !== 'object' || (settings as Record<string, unknown>)[key] !== false;
}

function policyWindowLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

@Processor(NOTIFICATION_QUEUE, {
  // Delivery logging uses per-instance job context, so this worker must remain serial.
  concurrency: 1,
  limiter: {
    max: Number(process.env.NOTIFICATION_RATE_MAX ?? 10),
    duration: Number(process.env.NOTIFICATION_RATE_DURATION_MS ?? 60_000),
  },
})
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);
  private email = new ResendEmailProvider();
  private sms   = new TwilioSmsProvider();
  // The job name currently being processed, used to label delivery-log rows.
  // (Worker concurrency is 1, so this is stable across a single job.)
  private currentType = '';
  private currentBusinessId: string | null = null;
  private currentUserId: string | null = null;
  private currentDedupeScope: string | null = null;

  // Client language follows the most recent booking. This also covers clients
  // created before appointment.locale was introduced, without another nullable
  // preference column or a destructive backfill.
  private async clientLocale(clientId: string): Promise<'en' | 'fr'> {
    const latest = await this.prisma.appointment.findFirst({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    });
    return (latest as (typeof latest & { locale?: string }))?.locale === 'fr' ? 'fr' : 'en';
  }

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private events: EventsGateway,
  ) {
    super();
    this.installDeliveryLogging();
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(
      `Notification job ${job?.id ?? '?'} (${job?.name ?? 'unknown'}) failed after ${job?.attemptsMade ?? 0} attempt(s): ${error.message}`,
      error.stack,
    );
  }

  // Wrap the providers so every email/SMS send is recorded in NotificationDelivery
  // (sent or failed) with zero changes at the ~14 call sites. Best-effort: a
  // logging failure never affects the actual send.
  private installDeliveryLogging() {
    const log = (channel: 'EMAIL' | 'SMS', recipient: string, status: 'SENT' | 'FAILED', error?: string) => {
      const dedupeKey = this.currentDedupeScope
        ? `${this.currentDedupeScope}:${this.currentType || 'unknown'}:${channel}`
        : null;
      const data = {
        channel,
        recipient,
        type: this.currentType || 'unknown',
        status,
        error,
        businessId: this.currentBusinessId ?? undefined,
        userId: this.currentUserId ?? undefined,
      } as const;
      return (dedupeKey
        ? this.prisma.notificationDelivery.upsert({
            where: { dedupeKey },
            create: { ...data, dedupeKey },
            update: data,
          })
        : this.prisma.notificationDelivery.create({ data }))
        .catch(() => {});
    };
    // Anti-bust guard: jobs already run once (attempts:1, no retries). On top of
    // that, suppress an *identical* message (same channel + recipient + type) sent
    // in the last 2 minutes, so a double-trigger can't fire two emails/texts and
    // burn the business's quota. Auth/transactional types that legitimately repeat
    // (OTP, verify, reset, security) are never suppressed.
    const ALWAYS_SEND = new Set(['otp', 'verify-email', 'password-reset', 'security-alert', 'plan-changed']);
    const isDuplicate = async (channel: 'EMAIL' | 'SMS', recipient: string): Promise<boolean> => {
      const type = this.currentType || 'unknown';
      if (ALWAYS_SEND.has(type)) return false;
      try {
        const dup = await this.prisma.notificationDelivery.findFirst({
          where: this.currentDedupeScope
            ? { dedupeKey: `${this.currentDedupeScope}:${type}:${channel}`, status: 'SENT' }
            : { channel, recipient, type, status: 'SENT', createdAt: { gt: new Date(Date.now() - 120_000) } },
          select: { id: true },
        });
        return !!dup;
      } catch { return false; }
    };
    const origEmail = this.email.send.bind(this.email);
    this.email.send = async (payload) => {
      if (await isDuplicate('EMAIL', payload.to)) return; // suppress duplicate — saves quota
      try { await origEmail(payload); await log('EMAIL', payload.to, 'SENT'); }
      catch (e) { await log('EMAIL', payload.to, 'FAILED', e instanceof Error ? e.message : String(e)); throw e; }
    };
    const origSms = this.sms.send.bind(this.sms);
    this.sms.send = async (payload) => {
      if (await isDuplicate('SMS', payload.to)) return; // suppress duplicate — saves SMS cost
      try { await origSms(payload); await log('SMS', payload.to, 'SENT'); }
      catch (e) { await log('SMS', payload.to, 'FAILED', e instanceof Error ? e.message : String(e)); throw e; }
    };
  }

  // Win-back: email clients who completed a visit but haven't been back (or booked)
  // in ~3 months, inviting them to rebook. Paid feature (Basic/Pro). Each client is
  // emailed at most once per 6 months (checked against the delivery log), so it
  // Daily birthday greeting for clients whose stored "MM-DD" is today. Paid plans
  // only; deduped so a client gets at most one greeting per year.
  private async runBirthdayScan() {
    const now = new Date();
    const mmdd = `${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`;
    const paid = await this.prisma.business.findMany({
      where: { plan: { in: ['BASIC', 'PRO', 'UNLIMITED'] } },
      select: { id: true },
    });
    const bizIds = paid.map((b) => b.id);
    if (!bizIds.length) return;

    const birthdayClients = await this.prisma.client.findMany({
      where: { businessId: { in: bizIds }, birthday: mmdd },
      include: { business: true },
      take: 200,
    });

    const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000);
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    for (const c of birthdayClients) {
      if (!c.email) continue;
      const already = await this.prisma.notificationDelivery.findFirst({
        where: { businessId: c.businessId, recipient: c.email, type: 'birthday', status: 'SENT', createdAt: { gt: sixMonthsAgo } },
        select: { id: true },
      });
      if (already) continue;
      this.currentType = 'birthday';
      this.currentBusinessId = c.businessId;
      const locale = await this.clientLocale(c.id);
      const fr = locale === 'fr';
      const bookUrl = `${baseUrl}/book/${encodeURIComponent(c.business.slug)}${fr ? '?lang=fr' : ''}`;
      await this.email.send({
        to: c.email,
        subject: fr ? `Joyeux anniversaire de la part de ${c.business.name}! 🎉` : `Happy birthday from ${c.business.name}! 🎉`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Joyeux anniversaire' : 'Happy birthday'}, ${esc(firstName(c.name))}! 🎂</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Toute l’équipe de <strong>${esc(c.business.name)}</strong> vous souhaite une merveilleuse journée. Faites-vous plaisir — nous serions ravis de célébrer avec vous.` : `Everyone at <strong>${esc(c.business.name)}</strong> wishes you a wonderful day. Treat yourself — we'd love to help you celebrate.`}</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réserver un plaisir d’anniversaire' : 'Book a birthday treat'} →</a>
`, undefined, locale),
      }).catch(() => {});
    }
  }

  // never nags. Runs daily via the 'winback-scan' repeatable job.
  private async runWinbackScan() {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86_400_000);
    const sixMonthsAgo = new Date(Date.now() - 180 * 86_400_000);
    const paid = await this.prisma.business.findMany({
      where: { plan: { in: ['BASIC', 'PRO', 'UNLIMITED'] } },
      select: { id: true },
    });
    const bizIds = paid.map((b) => b.id);
    if (!bizIds.length) return;

    const lapsed = await this.prisma.client.findMany({
      where: {
        businessId: { in: bizIds },
        // Has completed a visit before, but nothing (booked or attended) in 90 days.
        appointments: { some: { status: 'COMPLETED' }, none: { startsAt: { gte: ninetyDaysAgo } } },
      },
      include: { business: true },
      take: 200,
    });

    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    for (const c of lapsed) {
      if (!c.email) continue;
      const already = await this.prisma.notificationDelivery.findFirst({
        where: { businessId: c.businessId, recipient: c.email, type: 'rebook-reminder', status: 'SENT', createdAt: { gt: sixMonthsAgo } },
        select: { id: true },
      });
      if (already) continue;
      this.currentType = 'rebook-reminder';
      this.currentBusinessId = c.businessId;
      const locale = await this.clientLocale(c.id);
      const fr = locale === 'fr';
      const bookUrl = `${baseUrl}/book/${encodeURIComponent(c.business.slug)}${fr ? '?lang=fr' : ''}`;
      await this.email.send({
        to: c.email,
        subject: fr ? `Vous nous manquez — ${c.business.name}` : `We haven't seen you in a while — ${c.business.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Ça fait longtemps' : "It's been a while"} 💛</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(c.name)}, votre dernière visite chez <strong>${esc(c.business.name)}</strong> remonte à environ trois mois. Nous espérons que vous allez bien et serions ravis de vous revoir!` : `Hi ${esc(c.name)}, it's been about three months since your last visit to <strong>${esc(c.business.name)}</strong>. We hope you're doing well — and we'd love to see you again!`}</p>
<p style="margin:0 0 20px;color:#374151;font-size:14px">${fr ? 'Lorsque vous serez prêt, réservez votre prochaine visite en ligne en quelques clics.' : "Whenever you're ready, you can book your next visit online in a couple of taps."}</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réserver votre prochaine visite' : 'Book your next visit'} →</a>
`, undefined, locale),
      }).catch(() => {});
    }
  }

  // Service-due: any SCHEDULED tracker whose date has arrived becomes DUE and
  // raises an in-app prompt to the owner ("approve to invite them to rebook").
  private async runServiceDueScan() {
    const due = await this.prisma.serviceDue.findMany({
      where: { status: 'SCHEDULED', dueAt: { lte: new Date() } },
      include: { client: { select: { name: true } }, service: { select: { name: true } } },
      take: 300,
    });
    for (const d of due) {
      await this.prisma.serviceDue.update({ where: { id: d.id }, data: { status: 'DUE' } });
      const svc = d.service?.name ? `${d.service.name} ` : '';
      await this.notifyOwners(d.businessId, {
        kind: 'SYSTEM',
        title: `Follow-up due — ${d.client.name}`,
        body: `${d.client.name}'s ${svc}visit is due. Approve to invite them to rebook, or reschedule it.`,
        linkUrl: '/dashboard/followups',
      }).catch(() => {});
    }
  }

  // Email + in-app confirmation when a business's subscription plan changes.
  private async sendPlanChangedEmail(businessId: string, plan: string) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'plan-changed';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true } });
    if (!owners.length) return;
    const perks: Record<string, string> = {
      BASIC: 'Deposits, card-on-file, client messaging replies, win-back emails and recurring follow-ups are now unlocked.',
      PRO: 'Everything in Basic, plus automatic no-show & late-cancellation charging, SMS reminders, and 2-way texting with your booked clients.',
      UNLIMITED: 'Everything in Pro is now active across all your locations. Multi-location management, full SMS reach across every branch, and Pulse branding removal are all enabled.',
      FREE: 'Your subscription was cancelled — your account is back on the Free plan. You can re-subscribe any time.',
    };
    const title = plan === 'FREE' ? 'Your plan was cancelled' : `You're now on the ${plan} plan 🎉`;
    const body = perks[plan] ?? `Your plan is now ${plan}.`;
    for (const o of owners) {
      await this.email.send({
        to: o.email,
        subject: title,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(o.name)}, ${esc(body)}</p>
<a href="${baseUrl}/dashboard/settings" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Open your dashboard →</a>
`),
      }).catch(() => {});
    }
    await this.notifyOwners(businessId, {
      kind: 'SYSTEM',
      title,
      body,
      linkUrl: '/dashboard/settings',
    }).catch(() => {});
  }

  // ── SaaS subscription lifecycle emails ────────────────────────────────────
  private fmtMoney(cents: number) {
    return `$${(Math.max(0, cents) / 100).toFixed(2)}`;
  }
  private fmtDateCa(iso: string | null) {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-CA', { dateStyle: 'medium' });
  }

  // Dunning: a recurring subscription charge failed — prompt the owner to fix it.
  private async sendSubscriptionPaymentFailedEmail(
    businessId: string,
    d: { amountDueCents: number; hostedInvoiceUrl: string | null; nextAttempt: string | null },
  ) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'subscription-payment-failed';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true } });
    if (!owners.length) return;
    const amount = this.fmtMoney(d.amountDueCents);
    const retryDate = this.fmtDateCa(d.nextAttempt);
    const retryLine = retryDate
      ? `We will automatically retry on ${retryDate}. Update your card now to avoid any interruption.`
      : `Please update your payment method now to keep your plan active.`;
    const manageUrl = d.hostedInvoiceUrl ?? `${baseUrl}/dashboard/settings?tab=billing`;
    const title = "Your Pulse payment did not go through";
    const body = `We could not process your ${amount} subscription payment. ${retryLine}`;
    for (const o of owners) {
      await this.email.send({
        to: o.email,
        subject: "⚠️ Action needed: your Pulse payment failed",
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(o.name)}, ${esc(body)} If the payment is not completed, your paid features will be paused.</p>
<a href="${manageUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Update payment method →</a>
`),
      }).catch(() => {});
    }
    await this.notifyOwners(businessId, { kind: 'PAYMENT', title, body, linkUrl: '/dashboard/settings?tab=billing' }).catch(() => {});
  }

  // Receipt: a recurring subscription renewal succeeded.
  private async sendSubscriptionRenewedEmail(
    businessId: string,
    d: { amountPaidCents: number; hostedInvoiceUrl: string | null; periodEnd: string | null },
  ) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'subscription-renewed';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true } });
    if (!owners.length) return;
    const amount = this.fmtMoney(d.amountPaidCents);
    const renews = this.fmtDateCa(d.periodEnd);
    const title = "Payment received — thank you";
    const body = renews
      ? `We have received your ${amount} Pulse subscription payment. Your plan is active and renews on ${renews}.`
      : `We have received your ${amount} Pulse subscription payment. Your plan is active.`;
    const receiptUrl = d.hostedInvoiceUrl ?? `${baseUrl}/dashboard/settings?tab=billing`;
    for (const o of owners) {
      await this.email.send({
        to: o.email,
        subject: "Your Pulse payment receipt",
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(o.name)}, ${esc(body)}</p>
<a href="${receiptUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View invoice →</a>
`),
      }).catch(() => {});
    }
    await this.notifyOwners(businessId, { kind: 'PAYMENT', title, body, linkUrl: '/dashboard/settings?tab=billing' }).catch(() => {});
  }

  // Heads-up: a free trial is about to convert to a paid charge.
  private async sendTrialEndingEmail(businessId: string, d: { trialEndsAt: string | null }) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'trial-ending';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true } });
    if (!owners.length) return;
    const ends = this.fmtDateCa(d.trialEndsAt);
    const title = "Your Pulse trial is ending soon";
    const body = ends
      ? `Your free trial ends on ${ends}. To keep your paid features, make sure a valid card is on file — you will be billed automatically when the trial ends.`
      : `Your free trial is ending soon. Add or confirm a payment method to keep your paid features without interruption.`;
    for (const o of owners) {
      await this.email.send({
        to: o.email,
        subject: "Your Pulse trial is ending soon",
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(o.name)}, ${esc(body)}</p>
<a href="${baseUrl}/dashboard/settings?tab=billing" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage billing →</a>
`),
      }).catch(() => {});
    }
    await this.notifyOwners(businessId, { kind: 'PAYMENT', title, body, linkUrl: '/dashboard/settings?tab=billing' }).catch(() => {});
  }

  // Welcome receipt: the first subscription charge at signup succeeded.
  private async sendFirstPaymentReceiptEmail(
    businessId: string,
    d: { amountPaidCents: number; hostedInvoiceUrl: string | null; periodEnd: string | null },
  ) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'first-payment-receipt';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const biz = await this.prisma.business.findUnique({ where: { id: businessId }, select: { plan: true } });
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true, locale: true } });
    if (!owners.length) return;
    const amount = this.fmtMoney(d.amountPaidCents);
    const plan = biz?.plan ?? '';
    const receiptUrl = d.hostedInvoiceUrl ?? `${baseUrl}/dashboard/settings?tab=billing`;
    for (const o of owners) {
      const fr = o.locale === 'fr';
      const renews = d.periodEnd ? new Date(d.periodEnd).toLocaleDateString(fr ? 'fr-CA' : 'en-CA', { dateStyle: 'medium' }) : null;
      const title = fr ? `Bienvenue sur Pulse ${plan} — paiement reçu` : `Welcome to Pulse ${plan} — payment received`;
      const body = fr
        ? `Merci! Nous avons reçu votre premier paiement de ${amount} et votre forfait ${plan} est maintenant actif${renews ? `, avec renouvellement le ${renews}` : ''}. Toutes vos fonctionnalités sont prêtes.`
        : `Thank you — we've received your first ${amount} payment and your ${plan} plan is now active${renews ? `, renewing on ${renews}` : ''}. All your features are ready to go.`;
      await this.email.send({
        to: o.email,
        subject: title,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? 'Bonjour' : 'Hi'} ${esc(o.name)}, ${esc(body)}</p>
<a href="${receiptUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Voir la facture' : 'View invoice'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      }).catch(() => {});
    }
    await this.notifyOwners(businessId, {
      kind: 'PAYMENT',
      title: `Payment received — Pulse ${plan} is active`,
      body: `Your first ${amount} payment was received. Welcome aboard!`,
      linkUrl: '/dashboard/settings?tab=billing',
    }).catch(() => {});
  }

  // Confirmation: the owner scheduled a cancellation (cancel at period end).
  private async sendSubscriptionCancellationScheduledEmail(businessId: string, d: { periodEnd: string | null }) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'subscription-cancellation-scheduled';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true, locale: true } });
    if (!owners.length) return;
    for (const o of owners) {
      const fr = o.locale === 'fr';
      const until = d.periodEnd ? new Date(d.periodEnd).toLocaleDateString(fr ? 'fr-CA' : 'en-CA', { dateStyle: 'medium' }) : null;
      const title = fr ? 'Votre forfait Pulse est programmé pour être annulé' : 'Your Pulse plan is set to cancel';
      const body = fr
        ? `Votre abonnement est programmé pour prendre fin${until ? ` le ${until}` : ' à la fin de la période en cours'}. Vous conservez un accès complet jusque-là. Vous avez changé d’avis? Réactivez à tout moment avant cette date.`
        : `Your subscription is scheduled to end${until ? ` on ${until}` : ' at the end of your current period'}. You keep full access until then. Changed your mind? You can reactivate any time before that date.`;
      await this.email.send({
        to: o.email,
        subject: title,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? 'Bonjour' : 'Hi'} ${esc(o.name)}, ${esc(body)}</p>
<a href="${baseUrl}/dashboard/settings?tab=billing" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réactiver mon forfait' : 'Reactivate my plan'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      }).catch(() => {});
    }
    const enUntil = this.fmtDateCa(d.periodEnd);
    await this.notifyOwners(businessId, {
      kind: 'PAYMENT',
      title: 'Plan scheduled to cancel',
      body: enUntil ? `You keep access until ${enUntil}. Reactivate any time before then.` : 'Reactivate any time before your period ends.',
      linkUrl: '/dashboard/settings?tab=billing',
    }).catch(() => {});
  }

  // ── Complimentary / influencer plan lifecycle emails ─────────────────────
  // Welcome: an influencer/VIP was just granted a complimentary plan.
  private async sendCompPlanGrantedEmail(businessId: string, plan: string, expiresAtIso: string | null) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'comp-plan-granted';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true, locale: true } });
    if (!owners.length) return;
    for (const o of owners) {
      const fr = o.locale === 'fr';
      const endStr = expiresAtIso ? new Date(expiresAtIso).toLocaleDateString(fr ? 'fr-CA' : 'en-CA', { dateStyle: 'medium' }) : null;
      const title = fr ? `Vous avez reçu l’accès ${plan} gratuit 🎉` : `You've been given complimentary ${plan} access 🎉`;
      const body = fr
        ? `Bonne nouvelle! Votre compte a été mis à niveau vers ${plan}${endStr ? ` jusqu’au ${endStr}` : ''}, gratuitement. Toutes les fonctionnalités ${plan} sont maintenant activées — explorez-les dès aujourd’hui.`
        : `Great news — your account has been upgraded to ${plan}${endStr ? ` until ${endStr}` : ''}, on the house. All ${plan} features are now unlocked — dive in and explore them today.`;
      await this.email.send({
        to: o.email,
        subject: title,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? 'Bonjour' : 'Hi'} ${esc(o.name)}, ${esc(body)}</p>
<a href="${baseUrl}/dashboard" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Ouvrir votre tableau de bord' : 'Open your dashboard'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      }).catch(() => {});
    }
    const enEnd = this.fmtDateCa(expiresAtIso);
    await this.notifyOwners(businessId, {
      kind: 'SYSTEM',
      title: `Complimentary ${plan} access activated 🎉`,
      body: enEnd ? `Active until ${enEnd}. Enjoy all ${plan} features.` : `Enjoy all ${plan} features.`,
      linkUrl: '/dashboard',
    }).catch(() => {});
  }

  // Expiry: a complimentary grant lapsed and the plan reverted — invite them to subscribe.
  private async sendCompPlanExpiredEmail(businessId: string, restoredPlan: string) {
    if (!businessId) return;
    this.currentBusinessId = businessId;
    this.currentType = 'comp-plan-expired';
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true, locale: true } });
    if (!owners.length) return;
    for (const o of owners) {
      const fr = o.locale === 'fr';
      const planLabel = restoredPlan === 'FREE' ? (fr ? 'gratuit (Free)' : 'Free') : restoredPlan;
      const title = fr ? 'Votre accès gratuit est terminé' : 'Your complimentary access has ended';
      const body = fr
        ? `Votre période d’accès gratuit est terminée et votre compte est revenu au forfait ${planLabel}. Abonnez-vous pour retrouver les fonctionnalités que vous utilisiez.`
        : `Your complimentary access period has ended and your account has returned to the ${planLabel} plan. Subscribe now to regain the features you were using.`;
      await this.email.send({
        to: o.email,
        subject: title,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? 'Bonjour' : 'Hi'} ${esc(o.name)}, ${esc(body)}</p>
<a href="${baseUrl}/dashboard/settings?tab=billing" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Choisir un forfait' : 'Choose a plan'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      }).catch(() => {});
    }
    await this.notifyOwners(businessId, {
      kind: 'PAYMENT',
      title: 'Complimentary access ended',
      body: 'Subscribe to keep the features you were using.',
      linkUrl: '/dashboard/settings?tab=billing',
    }).catch(() => {});
  }

  // Daily countdown: warn owners 14 / 7 / 1 days before a complimentary grant
  // lapses. Each threshold fires at most once per business (deduped via the
  // delivery log), so a business gets up to three reminders as it counts down.
  private async runCompPlanExpiryScan() {
    const now = Date.now();
    const horizon = new Date(now + 14 * 86_400_000);
    const businesses = await this.prisma.business.findMany({
      where: { complimentaryPlanExpiresAt: { gt: new Date(now), lte: horizon } },
      select: { id: true, plan: true, complimentaryPlanExpiresAt: true },
    });
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    for (const b of businesses) {
      if (!b.complimentaryPlanExpiresAt) continue;
      const daysLeft = Math.ceil((b.complimentaryPlanExpiresAt.getTime() - now) / 86_400_000);
      const bucket = daysLeft <= 1 ? 1 : daysLeft <= 7 ? 7 : 14;
      const type = `comp-plan-expiring-${bucket}`;
      const owners = await this.prisma.user.findMany({ where: { businessId: b.id, role: 'OWNER' }, select: { email: true, name: true, locale: true } });
      if (!owners.length) continue;
      this.currentBusinessId = b.id;
      this.currentType = type;
      let sentAny = false;
      for (const o of owners) {
        const already = await this.prisma.notificationDelivery.findFirst({
          where: { businessId: b.id, recipient: o.email, type, status: 'SENT' },
          select: { id: true },
        });
        if (already) continue;
        const fr = o.locale === 'fr';
        const endStr = b.complimentaryPlanExpiresAt.toLocaleDateString(fr ? 'fr-CA' : 'en-CA', { dateStyle: 'medium' });
        const dayWord = fr ? (daysLeft > 1 ? 'jours' : 'jour') : (daysLeft > 1 ? 'days' : 'day');
        const title = fr ? `Votre accès ${b.plan} gratuit se termine bientôt` : `Your complimentary ${b.plan} access ends soon`;
        const body = fr
          ? `Il vous reste ${daysLeft} ${dayWord} d’accès ${b.plan} gratuit (jusqu’au ${endStr}). Abonnez-vous dès maintenant pour conserver vos fonctionnalités sans interruption.`
          : `You have ${daysLeft} ${dayWord} of complimentary ${b.plan} access left (until ${endStr}). Subscribe now to keep your features without interruption.`;
        await this.email.send({
          to: o.email,
          subject: title,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${esc(title)}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? 'Bonjour' : 'Hi'} ${esc(o.name)}, ${esc(body)}</p>
<a href="${baseUrl}/dashboard/settings?tab=billing" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Choisir un forfait' : 'Choose a plan'} →</a>
`, undefined, fr ? 'fr' : 'en'),
        }).catch(() => {});
        sentAny = true;
      }
      // Only raise the in-app banner when a threshold was actually crossed, so
      // owners don't get a daily nudge for every day inside the 14-day window.
      if (sentAny) {
        const word = daysLeft > 1 ? 'days' : 'day';
        await this.notifyOwners(b.id, {
          kind: 'PAYMENT',
          title: `Complimentary ${b.plan} ends in ${daysLeft} ${word}`,
          body: `Subscribe to keep your ${b.plan} features when the free period ends.`,
          linkUrl: '/dashboard/settings?tab=billing',
        }).catch(() => {});
      }
    }
  }

  // In-app inbox notification to a business's owner(s). Best-effort.
  private async notifyOwners(
    businessId: string,
    data: { kind: 'BOOKING_NEW' | 'BOOKING_UPDATE' | 'PAYMENT' | 'SYSTEM'; title: string; body?: string; linkUrl?: string },
  ) {
    try {
      const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { id: true } });
      if (!owners.length) return;
      await this.prisma.notification.createMany({
        data: owners.map((o) => ({ userId: o.id, kind: data.kind, title: data.title, body: data.body ?? null, linkUrl: data.linkUrl ?? null })),
      });
      this.events.emitNotificationCreated(businessId);
      await this.sendPushToUsers(owners.map((o) => o.id), {
        businessId,
        title: data.title,
        body: data.body,
      });
    } catch { /* never block the job on inbox writes */ }
  }

  private async notifyStaffAndOwners(
    businessId: string,
    staffUserId: string | null,
    data: { kind: 'BOOKING_NEW' | 'BOOKING_UPDATE' | 'PAYMENT' | 'SYSTEM'; title: string; body?: string; linkUrl?: string },
  ) {
    try {
      const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { id: true } });
      const targetUserIds = [...new Set([...owners.map(o => o.id), ...(staffUserId ? [staffUserId] : [])])];
      
      if (!targetUserIds.length) return;

      await this.prisma.notification.createMany({
        data: targetUserIds.map((id) => ({
          userId: id,
          kind: data.kind,
          title: data.title,
          body: data.body ?? null,
          linkUrl: data.linkUrl ?? null
        })),
      });
      this.events.emitNotificationCreated(businessId);
      await this.sendPushToUsers(targetUserIds, {
        businessId,
        title: data.title,
        body: data.body,
      });
    } catch { /* never block the job on inbox writes */ }
  }

  private async sendPushToUsers(userIds: string[], data: { businessId?: string; title: string; body?: string }) {
    try {
      if (!userIds.length) return;
      const tokens = await this.prisma.deviceToken.findMany({
        where: { userId: { in: userIds }, enabled: true },
        select: { token: true, userId: true },
      });
      if (!tokens.length) return;
      await Promise.all(tokens.map(async (row) => {
        try {
          const res = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            signal: AbortSignal.timeout(10_000),
            headers: {
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: row.token,
              sound: 'default',
              title: data.title,
              body: data.body ?? data.title,
              priority: this.currentType === 'priority-message-alert' ? 'high' : 'default',
              ...(this.currentType === 'priority-message-alert' ? { channelId: 'client-messages' } : {}),
              data: { businessId: data.businessId },
            }),
          });
          if (!res.ok) throw new Error(`Expo push HTTP ${res.status}`);
          await this.prisma.notificationDelivery.create({
            data: {
              businessId: data.businessId,
              userId: row.userId,
              channel: 'PUSH',
              recipient: row.token,
              type: this.currentType || 'owner-notification',
              status: 'SENT',
            },
          });
        } catch (e) {
          await this.prisma.notificationDelivery.create({
            data: {
              businessId: data.businessId,
              userId: row.userId,
              channel: 'PUSH',
              recipient: row.token,
              type: this.currentType || 'owner-notification',
              status: 'FAILED',
              error: e instanceof Error ? e.message : String(e),
            },
          }).catch(() => {});
        }
      }));
    } catch { /* push is best-effort */ }
  }

  async process(job: Job<{ appointmentId?: string; expectedStartsAt?: string; messageId?: string; dueId?: string; waitlistEntryId?: string; campaignId?: string; clientId?: string; giftCardId?: string; userId?: string; resetToken?: string; ip?: string; userAgent?: string; otpCode?: string; otpMethod?: string; otpPhone?: string; businessId?: string; plan?: string; feeCents?: number; amountDueCents?: number; amountPaidCents?: number; hostedInvoiceUrl?: string | null; nextAttempt?: string | null; periodEnd?: string | null; trialEndsAt?: string | null; expiresAt?: string | null }>) {
    // Access expiry is state maintenance, not a user notification, so it must
    // still run when outbound notifications are disabled.
    if (job.name === 'expire-complimentary-plans') {
      const expired = await this.prisma.business.findMany({
        where: { complimentaryPlanExpiresAt: { lte: new Date() } },
        select: { id: true, complimentaryPreviousPlan: true },
      });
      for (const business of expired) {
        const restoredPlan = business.complimentaryPreviousPlan ?? 'FREE';
        await this.prisma.$transaction([
          this.prisma.business.update({
            where: { id: business.id },
            data: {
              plan: restoredPlan,
              complimentaryPlanExpiresAt: null,
              complimentaryPreviousPlan: null,
            },
          }),
          this.prisma.auditLog.create({
            data: {
              entityType: 'BUSINESS',
              entityId: business.id,
              action: 'COMPLIMENTARY_PLAN_EXPIRED',
              changes: { restoredPlan },
            },
          }),
        ]);
        // Notify the owner their complimentary access ended (email + in-app) and
        // invite them to subscribe. The revert above is state maintenance and
        // always runs; the notice honours NOTIFICATIONS_ENABLED like every other send.
        if (process.env.NOTIFICATIONS_ENABLED !== 'false') {
          await this.sendCompPlanExpiredEmail(business.id, restoredPlan).catch(() => {});
        }
      }
      return;
    }
    if (process.env.NOTIFICATIONS_ENABLED === 'false') {
      this.logger.warn(`[Notification skipped] NOTIFICATIONS_ENABLED=false job=${job.name} id=${job.id}`);
      return;
    }
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    this.currentType = job.name; // label for the delivery log
    this.currentBusinessId = null;
    this.currentUserId = job.data.userId ?? null;
    this.currentDedupeScope = job.data.appointmentId
      ? `appointment:${job.data.appointmentId}`
      : job.data.messageId
        ? `message:${job.data.messageId}`
        : job.data.dueId ? `follow-up:${job.data.dueId}` : null;

    if (job.name === 'custom-follow-up') {
      const due = await this.prisma.serviceDue.findUnique({
        where: { id: job.data.dueId! },
        include: { client: true, business: true },
      });
      if (!due || due.status === 'CANCELLED') return;
      this.currentBusinessId = due.businessId;
      const locale = await this.clientLocale(due.clientId);
      const fr = locale === 'fr';
      const bookUrl = `${baseUrl}/book/${due.business.slug}${fr ? '?lang=fr' : ''}`;
      const subject = due.messageSubject || (fr ? `Un suivi de ${due.business.name}` : `A follow-up from ${due.business.name}`);
      const body = due.messageBody || (fr ? `Il est temps de prendre votre prochain rendez-vous avec ${due.business.name}.` : `It is time to book your next appointment with ${due.business.name}.`);
      if (due.client.email) await this.email.send({
        to: due.client.email,
        subject,
        html: emailWrap(`<p style="margin:0 0 18px;color:#374151;font-size:14px;white-space:pre-wrap">${esc(body)}</p><a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réserver le suivi' : 'Book follow-up'}</a>`, undefined, locale),
      });
      if (due.client.phone) await this.sms.send({ to: due.client.phone, body: `${due.business.name}: ${body} ${bookUrl}`.slice(0, 1500) });
      return;
    }

    if (job.name === 'priority-message-alert') {
      const message = await this.prisma.message.findUnique({
        where: { id: job.data.messageId! },
        include: { client: { select: { name: true } } },
      });
      if (!message || !message.fromClient) return;
      this.currentBusinessId = message.businessId;
      const users = await this.prisma.user.findMany({
        where: {
          businessId: message.businessId,
          OR: [
            { role: 'OWNER' },
            {
              role: 'STAFF',
              staff: {
                active: true,
                appointments: { some: { businessId: message.businessId, clientId: message.clientId } },
              },
            },
          ],
        },
        select: { id: true },
      });
      await this.sendPushToUsers(users.map((user) => user.id), {
        businessId: message.businessId,
        title: `Urgent message from ${message.client.name}`,
        body: message.content.slice(0, 160),
      });
      return;
    }

    // 2FA one-time code (email, or SMS if the method is SMS and a phone exists).
    if (job.name === 'otp') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user || !job.data.otpCode) return;
      this.currentBusinessId = user.businessId;
      const code = job.data.otpCode;
      const fr = user.locale === 'fr';
      if (job.data.otpMethod === 'SMS' && job.data.otpPhone) {
        await this.sms.send({
          to: job.data.otpPhone,
          body: fr
            ? `Votre code de vérification Pulse est ${code}. Il expire dans 10 minutes.`
            : `Your Pulse verification code is ${code}. It expires in 10 minutes.`,
        });
      } else {
        await this.email.send({
          to: user.email,
          subject: fr ? `Votre code de vérification Pulse : ${code}` : `Your Pulse verification code: ${code}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Votre code de vérification' : 'Your verification code'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(user.name)}, saisissez ce code pour terminer votre connexion. Il expire dans 10 minutes.` : `Hi ${esc(user.name)}, enter this code to finish signing in. It expires in 10 minutes.`}</p>
<div style="background:#FEF7EC;border:1px dashed #E9A23C;border-radius:12px;padding:18px;text-align:center;margin:0 0 8px">
  <p style="margin:0;color:#E9A23C;font-size:30px;font-weight:800;letter-spacing:6px">${code}</p>
</div>
<p style="margin:0;color:#9CA3AF;font-size:12px">${fr ? "Si vous n’avez pas tenté de vous connecter, vous pouvez ignorer ce courriel." : "If you didn't try to sign in, you can ignore this email."}</p>
`, undefined, fr ? 'fr' : 'en'),
        });
      }
      return;
    }

    // Email-verification link.
    if (job.name === 'verify-email') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user || !job.data.resetToken) return;
      this.currentBusinessId = user.businessId;
      const fr = user.locale === 'fr';
      const link = `${baseUrl}/verify-email?token=${job.data.resetToken}${fr ? '&lang=fr' : ''}`;
      await this.email.send({
        to: user.email,
        subject: fr ? 'Vérifiez votre adresse courriel pour Pulse' : 'Verify your email for Pulse',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Confirmez votre adresse courriel' : 'Confirm your email'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(user.name)}, confirmez votre adresse courriel pour consulter vos réservations et vos messages.` : `Hi ${esc(user.name)}, please confirm this is your email address so you can view your bookings and messages.`}</p>
<a href="${link}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Vérifier mon adresse courriel' : 'Verify email'} →</a>
<p style="margin:16px 0 0;color:#9CA3AF;font-size:12px">${fr ? "Ce lien expire dans 7 jours. Si vous n’avez pas créé de compte Pulse, ignorez ce courriel." : "This link expires in 7 days. If you didn't create a Pulse account, you can ignore this email."}</p>
`, undefined, fr ? 'fr' : 'en'),
      });
      return;
    }

    // Welcome email — new owner just registered.
    if (job.name === 'welcome') {
      const user = await this.prisma.user.findUnique({
        where: { id: job.data.userId! },
        include: { business: true },
      });
      if (!user) return;
      this.currentBusinessId = user.businessId;
      const fr = user.locale === 'fr';
      const bizName = user.business?.name ?? (fr ? 'votre entreprise' : 'your business');
      await this.email.send({
        to: user.email,
        subject: fr ? `Bienvenue sur Pulse, ${user.name.split(' ')[0]}! 🎉` : `Welcome to Pulse, ${user.name.split(' ')[0]}! 🎉`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Bienvenue! 🎉' : 'Welcome aboard! 🎉'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(user.name)}, votre compte pour <strong>${esc(bizName)}</strong> est prêt. Voici comment commencer :` : `Hi ${esc(user.name)}, your account for <strong>${esc(bizName)}</strong> is ready. Here's how to get set up:`}</p>
<ol style="margin:0 0 16px;padding-left:20px;color:#374151;font-size:14px;line-height:1.7">
  <li>${fr ? 'Ajoutez vos services et vos prix' : 'Add your services and prices'}</li>
  <li>${fr ? 'Ajoutez votre équipe et ses disponibilités' : 'Add your team and their availability'}</li>
  <li>${fr ? 'Partagez votre lien de réservation et recevez votre premier rendez-vous' : 'Share your booking link and take your first appointment'}</li>
</ol>
<a href="${baseUrl}/dashboard" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Ouvrir votre tableau de bord' : 'Open your dashboard'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      });
      return;
    }

    // Password reset — email the single-use reset link.
    if (job.name === 'password-reset') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user || !job.data.resetToken) return;
      this.currentBusinessId = user.businessId;
      const fr = user.locale === 'fr';
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(job.data.resetToken)}${fr ? '&lang=fr' : ''}`;
      await this.email.send({
        to: user.email,
        subject: fr ? 'Réinitialisez votre mot de passe Pulse' : 'Reset your Pulse password',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Réinitialisez votre mot de passe' : 'Reset your password'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(user.name)}, nous avons reçu une demande de réinitialisation de votre mot de passe. Ce lien expire dans 15 minutes. Si vous n’avez pas fait cette demande, ignorez ce courriel.` : `Hi ${esc(user.name)}, we received a request to reset your password. This link expires in 15 minutes. If you didn't ask for this, you can safely ignore this email.`}</p>
<a href="${resetUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réinitialiser le mot de passe' : 'Reset password'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      });
      return;
    }

    // Security alert — sign-in from a new device.
    if (job.name === 'security-alert') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user) return;
      this.currentBusinessId = user.businessId;
      const fr = user.locale === 'fr';
      const resetUrl = job.data.resetToken ? `${baseUrl}/reset-password?token=${encodeURIComponent(job.data.resetToken)}${fr ? '&lang=fr' : ''}` : `${baseUrl}/forgot-password${fr ? '?lang=fr' : ''}`;
      const device = esc((job.data.userAgent || (fr ? 'un appareil non reconnu' : 'an unrecognized device')).slice(0, 120));
      const ip = job.data.ip ? ` (IP ${esc(job.data.ip)})` : '';
      await this.email.send({
        to: user.email,
        subject: fr ? '🔐 Nouvelle connexion à votre compte Pulse' : '🔐 New sign-in to your Pulse account',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Nouvelle connexion détectée' : 'New sign-in detected'}</h2>
<p style="margin:0 0 12px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(user.name)}, une connexion à votre compte Pulse vient d’être effectuée à partir d’un nouvel appareil :` : `Hi ${esc(user.name)}, your Pulse account was just signed into from a device we haven't seen before:`}</p>
<p style="margin:0 0 16px;color:#374151;font-size:13px;background:#F8F9FA;border-radius:10px;padding:12px">${device}${ip}</p>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? '<strong>Si c’était vous</strong>, ignorez ce courriel. <strong>Sinon</strong>, réinitialisez immédiatement votre mot de passe pour protéger votre compte.' : "<strong>If this was you</strong>, you can ignore this email. <strong>If it wasn't</strong>, reset your password right away to secure your account."}</p>
<a href="${resetUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réinitialiser mon mot de passe' : 'Reset my password'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      });
      return;
    }

    // Gift card issued — email the recipient their code.
    if (job.name === 'gift-card-issued') {
      const card = await this.prisma.giftCard.findUnique({
        where: { id: job.data.giftCardId! },
        include: { business: true },
      });
      if (!card || !card.recipientEmail) return;
      this.currentBusinessId = card.businessId;
      const locale = (card as typeof card & { locale?: string }).locale === 'fr' ? 'fr' : 'en';
      const fr = locale === 'fr';
      const amount = new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA', { style: 'currency', currency: card.business.currency ?? 'CAD' }).format(card.initialCents / 100);
      await this.email.send({
        to: card.recipientEmail,
        subject: fr ? `Vous avez reçu une carte-cadeau de ${amount} pour ${card.business.name}! 🎁` : `You've received a ${amount} gift card for ${card.business.name}! 🎁`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Un cadeau rien que pour vous' : 'A gift just for you'} 🎁</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `${card.purchaserName ? esc(card.purchaserName) + ' vous a envoyé' : 'Vous avez reçu'} une carte-cadeau de <strong>${esc(amount)}</strong> pour <strong>${esc(card.business.name)}</strong>.` : `${card.purchaserName ? `${esc(card.purchaserName)} sent you` : "You've received"} a <strong>${esc(amount)}</strong> gift card for <strong>${esc(card.business.name)}</strong>.`}</p>
${card.message ? `<p style="margin:0 0 16px;color:#374151;font-size:14px;font-style:italic">"${esc(card.message)}"</p>` : ''}
<div style="background:#FEF7EC;border:1px dashed #E9A23C;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px">
  <p style="margin:0 0 4px;color:#6B7280;font-size:12px">${fr ? 'Votre code de carte-cadeau' : 'Your gift card code'}</p>
  <p style="margin:0;color:#E9A23C;font-size:22px;font-weight:700;letter-spacing:1px">${esc(card.code)}</p>
</div>
<p style="margin:0;color:#6B7280;font-size:13px">${fr ? `Présentez ce code lors de votre réservation ou de votre visite chez ${esc(card.business.name)}.` : `Present this code when you book or visit ${esc(card.business.name)}.`}</p>
`, undefined, locale),
      });
      return;
    }

    // Marketing campaign — one job per recipient, not tied to an appointment.
    if (job.name === 'campaign-message') {
      const [campaign, client] = await Promise.all([
        this.prisma.campaign.findUnique({ where: { id: job.data.campaignId! }, include: { business: true } }),
        this.prisma.client.findUnique({ where: { id: job.data.clientId! } }),
      ]);
      if (!campaign || !client) return;
      // N1: Cross-tenant guard — drop jobs where client doesn't belong to campaign's business.
      if (client.businessId !== campaign.businessId) return;
      // N2: Respect one-click unsubscribe opt-out.
      if (client.marketingOptOut) return;
      this.currentBusinessId = campaign.businessId;
      const locale = await this.clientLocale(client.id);
      const fr = locale === 'fr';
      const merge = (t: string) => t.replace(/\{name\}/g, () => client.name).replace(/\{business\}/g, () => campaign.business.name); // raw: SMS + subject; function replacer prevents re-expansion
      const mergeHtml = (t: string) => esc(t).replace(/\{name\}/g, () => esc(client.name)).replace(/\{business\}/g, () => esc(campaign.business.name));

      let sent = false;
      if (campaign.channel === 'SMS') {
        if (client.phone) {
          await this.sms.send({ to: client.phone, body: merge(campaign.body) });
          sent = true;
        }
      } else if (client.email) {
        const secret = this.configService.get<string>('JWT_SECRET') ?? '';
        const apiUrl = this.configService.get<string>('PUBLIC_API_URL') ?? baseUrl;
        const unsubscribeUrl = `${apiUrl}/notifications/unsubscribe?id=${encodeURIComponent(client.id)}&sig=${signUnsubscribeToken(client.id, secret)}`;
        await this.email.send({
          to: client.email,
          subject: merge(campaign.subject ?? (fr ? `Un message de ${campaign.business.name}` : `A note from ${campaign.business.name}`)),
          html: emailWrap(`<div style="color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${mergeHtml(campaign.body)}</div>`, unsubscribeUrl, locale),
        });
        sent = true;
      }
      if (sent) {
        await this.prisma.campaign.update({ where: { id: campaign.id, businessId: campaign.businessId }, data: { sentCount: { increment: 1 } } });
      }
      return;
    }

    // Waitlist opening — not tied to an appointment; email the waitlisted client.
    if (job.name === 'waitlist-opening') {
      const entry = await this.prisma.waitlistEntry.findUnique({
        where: { id: job.data.waitlistEntryId! },
        include: { business: true },
      });
      if (!entry) return;
      this.currentBusinessId = entry.businessId;
      const locale = (entry as typeof entry & { locale?: string }).locale === 'fr' ? 'fr' : 'en';
      const fr = locale === 'fr';
      const bookUrl = `${baseUrl}/book/${entry.business.slug}${fr ? '?lang=fr' : ''}`;
      await this.email.send({
        to: entry.email,
        subject: fr ? `Une place vient de se libérer chez ${entry.business.name}` : `A spot just opened at ${entry.business.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Une place vient de se libérer!' : 'A spot just opened up!'} 🎉</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(entry.name)}, une plage horaire vient de se libérer chez <strong>${esc(entry.business.name)}</strong>. Réservez maintenant avant qu’elle ne soit prise.` : `Hi ${esc(entry.name)}, a time just became available at <strong>${esc(entry.business.name)}</strong>. Book now before someone else grabs it.`}</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réserver maintenant' : 'Book now'} →</a>
`, undefined, locale),
      });
      return;
    }

    // Deposit payment failed — booking was auto-cancelled; inform the client.
    if (job.name === 'deposit-failed') {
      const apt = await this.prisma.appointment.findUnique({
        where: { id: job.data.appointmentId! },
        include: { client: true, service: true, staff: { include: { user: true } }, business: true },
      });
      if (!apt || !apt.client.email) return;
      this.currentBusinessId = apt.businessId;
      const fr = (apt as typeof apt & { locale?: string }).locale === 'fr';
      const bookUrl = `${baseUrl}/book/${apt.business.slug}${fr ? '?lang=fr' : ''}`;
      await this.email.send({
        to: apt.client.email,
        subject: fr ? 'Échec du paiement — réservation annulée' : `Payment failed — booking cancelled`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">${fr ? 'Échec du paiement' : 'Payment failed'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(firstName(apt.client.name))}, le paiement de votre dépôt pour <strong>${esc(apt.service.name)}</strong> chez <strong>${esc(apt.business.name)}</strong> n’a pas pu être traité; votre réservation a donc été annulée.` : `Hi ${esc(firstName(apt.client.name))}, unfortunately your deposit payment for <strong>${esc(apt.service.name)}</strong> with <strong>${esc(apt.business.name)}</strong> could not be processed, and your booking has been cancelled.`}</p>
${aptDetails(apt)}
<p style="margin:16px 0 0;color:#6B7280;font-size:13px">${fr ? 'Vérifiez les renseignements de votre carte et essayez de réserver de nouveau.' : 'Please check your card details and try booking again.'}</p>
<a href="${bookUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réserver de nouveau' : 'Book again'} →</a>
`, undefined, fr ? 'fr' : 'en'),
      }).catch(() => {});
      return;
    }

    // No-show fee charged — send a Pulse-branded notice so the client understands the charge.
    if (job.name === 'no-show-fee-charged') {
      const apt = await this.prisma.appointment.findUnique({
        where: { id: job.data.appointmentId! },
        include: { client: true, service: true, staff: { include: { user: true } }, business: true },
      });
      if (!apt || !apt.client.email) return;
      this.currentBusinessId = apt.businessId;
      const fr = (apt as typeof apt & { locale?: string }).locale === 'fr';
      const feeCents = job.data.feeCents ?? 0;
      const feeStr = new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA', { style: 'currency', currency: apt.business.currency ?? 'CAD' }).format(feeCents / 100);
      await this.email.send({
        to: apt.client.email,
        subject: fr ? `Frais d’absence facturés — ${apt.service.name}` : `No-show fee charged — ${apt.service.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? `Frais d’absence de ${esc(feeStr)} facturés` : `No-show fee of ${esc(feeStr)} charged`}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(firstName(apt.client.name))}, des frais d’absence ont été portés à votre carte enregistrée puisque vous ne vous êtes pas présenté au rendez-vous et ne l’avez pas annulé à l’avance.` : `Hi ${esc(firstName(apt.client.name))}, a no-show fee has been charged to your card on file because your appointment was not attended and was not cancelled in advance.`}</p>
${aptDetails(apt)}
<p style="margin:16px 0 0;color:#6B7280;font-size:13px">${fr ? `Pour toute question, communiquez directement avec <strong>${esc(apt.business.name)}</strong>.` : `If you have any questions, please contact <strong>${esc(apt.business.name)}</strong> directly.`}</p>
`, undefined, fr ? 'fr' : 'en'),
      }).catch(() => {});
      return;
    }

    // Late-cancellation fee charged — notify the client with context.
    if (job.name === 'cancellation-fee-charged') {
      const apt = await this.prisma.appointment.findUnique({
        where: { id: job.data.appointmentId! },
        include: { client: true, service: true, staff: { include: { user: true } }, business: true },
      });
      if (!apt || !apt.client.email) return;
      this.currentBusinessId = apt.businessId;
      const fr = (apt as typeof apt & { locale?: string }).locale === 'fr';
      const feeCents = job.data.feeCents ?? 0;
      const feeStr = new Intl.NumberFormat(fr ? 'fr-CA' : 'en-CA', { style: 'currency', currency: apt.business.currency ?? 'CAD' }).format(feeCents / 100);
      await this.email.send({
        to: apt.client.email,
        subject: fr ? `Frais d’annulation tardive facturés — ${apt.service.name}` : `Late-cancellation fee charged — ${apt.service.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? `Frais d’annulation tardive de ${esc(feeStr)} facturés` : `Late-cancellation fee of ${esc(feeStr)} charged`}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(firstName(apt.client.name))}, des frais d’annulation tardive ont été portés à votre carte enregistrée puisque le rendez-vous a été annulé après le délai établi par <strong>${esc(apt.business.name)}</strong>.` : `Hi ${esc(firstName(apt.client.name))}, a late-cancellation fee has been applied to your card on file because your appointment was cancelled after the cancellation window set by <strong>${esc(apt.business.name)}</strong>.`}</p>
${aptDetails(apt)}
<p style="margin:16px 0 0;color:#6B7280;font-size:13px">${fr ? `Si vous croyez qu’il s’agit d’une erreur, communiquez directement avec <strong>${esc(apt.business.name)}</strong>.` : `If you believe this was charged in error, please contact <strong>${esc(apt.business.name)}</strong> directly.`}</p>
`, undefined, fr ? 'fr' : 'en'),
      }).catch(() => {});
      return;
    }

    // Stripe Connect account approved — email the owner so they know they can take payments.
    if (job.name === 'connect-approved') {
      const businessId = job.data.businessId!;
      this.currentBusinessId = businessId;
      const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true, locale: true } });
      const dashUrl = `${baseUrl}/dashboard/settings`;
      for (const o of owners) {
        const fr = o.locale === 'fr';
        await this.email.send({
          to: o.email,
          subject: fr ? 'Votre compte Stripe est vérifié — vous pouvez maintenant accepter des paiements 🎉' : 'Your Stripe account is verified — you can now accept payments 🎉',
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Les paiements sont activés! 🎉' : 'Payments are live! 🎉'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(o.name)}, votre compte Stripe a été vérifié. Vous pouvez maintenant accepter les dépôts et les paiements par carte enregistrée; les versements seront déposés dans votre compte bancaire selon votre calendrier Stripe.` : `Hi ${esc(o.name)}, your Stripe account has been verified by Stripe. You can now accept deposits and card-on-file payments from clients — and payouts will be sent to your connected bank account on your Stripe payout schedule.`}</p>
<a href="${dashUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Accéder aux paramètres' : 'Go to settings'} →</a>
`, undefined, fr ? 'fr' : 'en'),
        }).catch(() => {});
      }
      return;
    }

    // Rebook reminder — automatically sent to lapsed clients.
    if (job.name === 'rebook-reminder') {
      const client = await this.prisma.client.findUnique({
        where: { id: job.data.clientId! },
        include: { business: true },
      });
      if (!client || !client.email) return;
      this.currentBusinessId = client.businessId;
      const locale = await this.clientLocale(client.id);
      const fr = locale === 'fr';
      const bookUrl = `${baseUrl}/book/${client.business.slug}${fr ? '?lang=fr' : ''}`;
      await this.email.send({
        to: client.email,
        subject: fr ? `Vous nous manquez chez ${client.business.name}!` : `We miss you at ${client.business.name}!`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Ça fait longtemps…' : "It's been a while..."}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${esc(client.name)}, quelques semaines se sont écoulées depuis votre dernière visite chez <strong>${esc(client.business.name)}</strong>. Nous serions ravis de vous revoir!` : `Hi ${esc(client.name)}, it's been a few weeks since your last visit to <strong>${esc(client.business.name)}</strong>. We'd love to see you again!`}</p>
<p style="margin:0 0 20px;color:#374151;font-size:14px">${fr ? 'Prêt pour votre prochain rendez-vous? Réservez instantanément en ligne.' : 'Ready for your next appointment? You can book instantly online.'}</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réserver votre prochaine visite' : 'Book your next visit'} →</a>
`, undefined, locale),
      });
      return;
    }

    // Daily lapsed-client scan → "we haven't seen you in ~3 months" win-backs.
    if (job.name === 'winback-scan') {
      await this.runWinbackScan();
      return;
    }

    // Daily service-due scan → flips due trackers to DUE + prompts the owner.
    if (job.name === 'service-due-scan') {
      await this.runServiceDueScan();
      return;
    }

    // Daily birthday scan → greet clients whose birthday is today.
    if (job.name === 'birthday-scan') {
      await this.runBirthdayScan();
      return;
    }

    // Weekly maintenance: prune expired OTP challenges and old login events.
    // Keeps both tables bounded and satisfies data-minimisation obligations.
    if (job.name === 'cleanup-stale-rows') {
      const ninety = new Date(Date.now() - 90 * 86_400_000);
      const [otpResult, loginResult] = await Promise.all([
        this.prisma.otpChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
        this.prisma.loginEvent.deleteMany({ where: { createdAt: { lt: ninety } } }),
      ]);
      this.logger.log(`cleanup-stale-rows: deleted ${otpResult.count} OTP challenges, ${loginResult.count} login events`);
      return;
    }

    // Subscription plan changed → email + in-app confirmation to the owner.
    if (job.name === 'plan-changed') {
      await this.sendPlanChangedEmail(String(job.data.businessId ?? ''), String(job.data.plan ?? 'FREE'));
      return;
    }

    if (job.name === 'subscription-payment-failed') {
      await this.sendSubscriptionPaymentFailedEmail(String(job.data.businessId ?? ''), {
        amountDueCents: Number(job.data.amountDueCents ?? 0),
        hostedInvoiceUrl: job.data.hostedInvoiceUrl ?? null,
        nextAttempt: job.data.nextAttempt ?? null,
      });
      return;
    }

    if (job.name === 'subscription-renewed') {
      await this.sendSubscriptionRenewedEmail(String(job.data.businessId ?? ''), {
        amountPaidCents: Number(job.data.amountPaidCents ?? 0),
        hostedInvoiceUrl: job.data.hostedInvoiceUrl ?? null,
        periodEnd: job.data.periodEnd ?? null,
      });
      return;
    }

    if (job.name === 'trial-ending') {
      await this.sendTrialEndingEmail(String(job.data.businessId ?? ''), {
        trialEndsAt: job.data.trialEndsAt ?? null,
      });
      return;
    }

    if (job.name === 'first-payment-receipt') {
      await this.sendFirstPaymentReceiptEmail(String(job.data.businessId ?? ''), {
        amountPaidCents: Number(job.data.amountPaidCents ?? 0),
        hostedInvoiceUrl: job.data.hostedInvoiceUrl ?? null,
        periodEnd: job.data.periodEnd ?? null,
      });
      return;
    }

    if (job.name === 'subscription-cancellation-scheduled') {
      await this.sendSubscriptionCancellationScheduledEmail(String(job.data.businessId ?? ''), {
        periodEnd: job.data.periodEnd ?? null,
      });
      return;
    }

    // Comp/influencer plan granted → welcome the owner (email + in-app).
    if (job.name === 'comp-plan-granted') {
      await this.sendCompPlanGrantedEmail(
        String(job.data.businessId ?? ''),
        String(job.data.plan ?? ''),
        job.data.expiresAt ?? null,
      );
      return;
    }

    // Daily countdown scan → 14/7/1-day "your complimentary access is ending" reminders.
    if (job.name === 'comp-plan-expiry-scan') {
      await this.runCompPlanExpiryScan();
      return;
    }

    const apt = await this.prisma.appointment.findUnique({
      where: { id: job.data.appointmentId! },
      include: { client: true, service: true, staff: { include: { user: true } }, business: true },
    });

    if (!apt) return;
    this.currentBusinessId = apt.businessId;
    const clientFirstName = esc(firstName(apt.client.name));
    const fr = (apt as typeof apt & { locale?: string }).locale === 'fr';

    const smsEnabled = isProPlan(apt.business.plan);
    const settings = apt.business.notificationSettings;
    const shouldSend = (key: NotificationKey) => notificationEnabled(settings, key);

    const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    // HMAC manage token so the link proves the recipient got the email (the
    // public booking endpoints reject an id without a valid token).
    const manageUrl = `${webUrl}/appointments/${apt.id}/manage${fr ? '?lang=fr' : ''}#token=${encodeURIComponent(signAppointmentToken(apt.id))}`;

    switch (job.name) {

      case 'review-request': {
        if (!apt.client.email) break;
        await this.email.send({
          to: apt.client.email,
          subject: fr ? `Comment s’est passée votre visite chez ${apt.business.name}?` : `How was your visit to ${apt.business.name}?`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Comment avons-nous fait?' : 'How did we do?'} ⭐</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, merci d’avoir choisi <strong>${esc(apt.business.name)}</strong>. Nous aimerions connaître votre avis sur votre service ${esc(apt.service.name)} avec ${esc(apt.staff.user.name)}.` : `Hi ${clientFirstName}, thanks for visiting <strong>${esc(apt.business.name)}</strong>. We'd love your feedback on your ${esc(apt.service.name)} with ${esc(apt.staff.user.name)}.`}</p>
<a href="${baseUrl}/review/${apt.id}${fr ? '?lang=fr' : ''}#token=${encodeURIComponent(signAppointmentToken(apt.id, 7 * 24 * 60 * 60))}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Laisser un avis' : 'Leave a review'} →</a>
`, undefined, fr ? 'fr' : 'en'),
        });
        break;
      }

      case 'send-pending': {
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Demande de réservation reçue — ${apt.service.name}` : `Booking request received — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Demande de réservation reçue' : 'Booking request received'} ⏳</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, votre demande attend l’approbation de` : `Hi ${clientFirstName}, your booking request has been received and is awaiting approval from`} <strong>${esc(apt.business.name)}</strong>. ${fr ? 'Vous recevrez un courriel dès sa confirmation.' : "You'll get a confirmation email once it's approved."}</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Voir la réservation' : 'View booking'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
        });
        if (apt.client.phone && smsEnabled) {
          await this.sms.send({
            to: apt.client.phone,
            body: fr
              ? `Demande de réservation reçue par ${apt.business.name}: ${apt.service.name}, le ${aptDate(apt, 'yyyy-MM-dd')} à ${aptDate(apt, 'HH:mm')}. ${manageUrl}`
              : `Booking request received by ${apt.business.name}: ${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}. ${manageUrl}`,
          });
        }
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `⏳ Demande de réservation reçue pour ${apt.service.name}, le ${aptDate(apt, 'yyyy-MM-dd')} à ${aptDate(apt, 'HH:mm')}. En attente d’approbation.`
          : `⏳ Booking request received for ${apt.service.name} on ${aptDate(apt, 'MMMM d, yyyy')} at ${aptDate(apt, 'h:mm a')}. Awaiting approval.`);
        await this.notifyOwners(apt.businessId, {
          kind: 'BOOKING_NEW',
          title: `New booking — ${apt.client.name}`,
          body: `${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')} — awaiting your approval.`,
          linkUrl: '/dashboard/appointments',
        });
        if (apt.client.email) await this.logNotification(apt.id, 'EMAIL', 'CONFIRMATION', 'SENT');
        if (apt.client.phone && smsEnabled) await this.logNotification(apt.id, 'SMS', 'CONFIRMATION', 'SENT');
        break;
      }

      case 'send-confirmation': {
        // Generate .ics calendar invite as a fallback — ensures clients always get a calendar event
        // even if the business hasn't connected Google Calendar.
        const icsContent = generateICalEvent({
          id: apt.id,
          startsAt: apt.startsAt,
          endsAt: apt.endsAt,
          service: apt.service,
          staff: apt.staff,
          client: apt.client,
          business: apt.business,
          notes: apt.notes,
          locationMode: apt.locationMode,
          meetingUrl: apt.meetingUrl,
          customerAddress: apt.customerAddress,
        });
        const icsAttachment = {
          filename: 'appointment.ics',
          content: Buffer.from(icsContent).toString('base64'),
          content_type: 'text/calendar; method=REQUEST',
        };
        const hasCardOnFile = !!apt.stripePaymentMethodId;
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Rendez-vous confirmé — ${apt.service.name}` : `Appointment confirmed — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Votre rendez-vous est réservé!' : "You're booked!"} ✓</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, votre rendez-vous est confirmé.` : `Hi ${clientFirstName}, your appointment is confirmed.`}</p>
${aptDetails(apt)}
<p style="margin:0;color:#6B7280;font-size:13px">${fr ? 'Vous recevrez un rappel 24 heures avant votre rendez-vous. Une invitation de calendrier est jointe.' : "You'll receive a reminder 24 hours before your appointment. A calendar invite is attached to this email."}</p>
${hasCardOnFile ? `<p style="margin:12px 0 0;color:#6B7280;font-size:12px">💳 ${fr ? `Une carte est enregistrée pour cette réservation afin de couvrir les absences et annulations. Vous pouvez la retirer dans votre <a href="${webUrl}/my/dashboard?lang=fr" style="color:#7C3AED">portail client</a>.` : `A card is saved on file for this booking (for no-show/cancellation protection). You can remove it anytime from your <a href="${webUrl}/my/dashboard" style="color:#7C3AED">client portal</a>.`}</p>` : ''}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Gérer le rendez-vous' : 'Manage appointment'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
          attachments: [icsAttachment],
        });
        if (apt.client.phone && smsEnabled && shouldSend('smsConfirmation')) {
          const where = whereText(apt);
          await this.sms.send({
            to: apt.client.phone,
            body: fr
              ? `Confirmé avec ${apt.business.name}: ${apt.service.name}, le ${aptDate(apt, 'yyyy-MM-dd')} à ${aptDate(apt, 'HH:mm')}.${where ? ` ${where}.` : ''} ${manageUrl}`
              : `Confirmed with ${apt.business.name}: ${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}.${where ? ` ${where}.` : ''} ${manageUrl}`,
          });
        }
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `✅ Rendez-vous confirmé : ${apt.service.name}, le ${aptDate(apt, 'yyyy-MM-dd')} à ${aptDate(apt, 'HH:mm')}.`
          : `✅ Appointment confirmed: ${apt.service.name} on ${aptDate(apt, 'MMMM d, yyyy')} at ${aptDate(apt, 'h:mm a')}.`);
        await this.notifyStaffAndOwners(apt.businessId, apt.staff.user.id, {
          kind: 'BOOKING_UPDATE',
          title: `Booking confirmed — ${apt.client.name}`,
          body: `${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}`,
          linkUrl: '/dashboard/appointments',
        });
        if (apt.client.email) await this.logNotification(apt.id, 'EMAIL', 'CONFIRMATION', 'SENT');
        if (apt.client.phone && smsEnabled && shouldSend('smsConfirmation')) await this.logNotification(apt.id, 'SMS', 'CONFIRMATION', 'SENT');
        break;
      }

      case 'reminder-72h': {
        if (apt.status !== 'CONFIRMED' || (job.data.expectedStartsAt && apt.startsAt.toISOString() !== job.data.expectedStartsAt)) break;
        if (!shouldSend('emailReminder72h')) {
          await this.logNotification(apt.id, 'EMAIL', 'REMINDER_72H', 'SKIPPED', 'disabled_by_business');
          break;
        }
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Rappel : ${apt.service.name} dans 3 jours` : `Reminder: ${apt.service.name} in 3 days`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Rendez-vous dans 3 jours' : 'Coming up in 3 days'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, voici un rappel de votre prochain rendez-vous.` : `Hi ${clientFirstName}, a heads-up about your upcoming appointment.`}</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Gérer le rendez-vous' : 'Manage appointment'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `📅 Rappel : votre rendez-vous pour ${apt.service.name} est dans 3 jours à ${aptDate(apt, 'HH:mm')}.`
          : `📅 Reminder: You have an appointment for ${apt.service.name} in 3 days at ${aptDate(apt, 'h:mm a')}.`);
        await this.logNotification(apt.id, 'EMAIL', 'REMINDER_72H', 'SENT');
        break;
      }

      case 'reminder-24h': {
        if (apt.status !== 'CONFIRMED' || (job.data.expectedStartsAt && apt.startsAt.toISOString() !== job.data.expectedStartsAt)) break;
        if (!shouldSend('emailReminder24h')) {
          await this.logNotification(apt.id, 'EMAIL', 'REMINDER_24H', 'SKIPPED', 'disabled_by_business');
          break;
        }
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Rappel : ${apt.service.name} demain` : `Reminder: ${apt.service.name} tomorrow`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'À demain!' : 'See you tomorrow!'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, voici un rappel de votre prochain rendez-vous.` : `Hi ${clientFirstName}, just a friendly reminder about your upcoming appointment.`}</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Gérer le rendez-vous' : 'Manage appointment'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `⏰ Rappel : votre rendez-vous pour ${apt.service.name} est demain à ${aptDate(apt, 'HH:mm')}.`
          : `⏰ Reminder: You have an appointment for ${apt.service.name} tomorrow at ${aptDate(apt, 'h:mm a')}.`);
        await this.logNotification(apt.id, 'EMAIL', 'REMINDER_24H', 'SENT');
        break;
      }

      case 'reminder-2h': {
        if (apt.status !== 'CONFIRMED' || (job.data.expectedStartsAt && apt.startsAt.toISOString() !== job.data.expectedStartsAt)) break;
        if (!shouldSend('smsReminder2h')) {
          await this.logNotification(apt.id, 'SMS', 'REMINDER_2H', 'SKIPPED', 'disabled_by_business');
          break;
        }
        if (apt.client.phone && smsEnabled) {
          const where = whereText(apt);
          await this.sms.send({
            to: apt.client.phone,
            body: fr
              ? `Rappel : ${apt.service.name} avec ${apt.staff.user.name} dans 2 heures, à ${aptDate(apt, 'HH:mm')}.${where ? ` ${where}.` : ''} ${manageUrl}`
              : `Reminder: ${apt.service.name} with ${apt.staff.user.name} in 2 hours at ${aptDate(apt, 'h:mm a')}.${where ? ` ${where}.` : ''} ${manageUrl}`,
          });
          await this.logNotification(apt.id, 'SMS', 'REMINDER_2H', 'SENT');
        }
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `🔔 Rappel : votre rendez-vous pour ${apt.service.name} est dans 2 heures.`
          : `🔔 Reminder: Your appointment for ${apt.service.name} is in 2 hours.`);
        break;
      }

      case 'follow-up-post-apt': {
        if (apt.status !== 'COMPLETED') break;
        if (!shouldSend('emailFollowUp')) {
          await this.logNotification(apt.id, 'EMAIL', 'FOLLOW_UP', 'SKIPPED', 'disabled_by_business');
          break;
        }
        const bookUrl = `${webUrl}/book/${apt.business.slug ?? ''}${fr ? '?lang=fr' : ''}`;
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Merci de votre visite chez ${apt.business.name}!` : `Thanks for visiting ${apt.business.name}!`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${fr ? 'Merci de votre visite!' : 'Thanks for your visit!'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, nous espérons que vous avez apprécié votre service ${esc(apt.service.name)} avec ${esc(apt.staff.user.name)}. Ce fut un plaisir de vous voir!` : `Hi ${clientFirstName}, we hope you enjoyed your ${esc(apt.service.name)} with ${esc(apt.staff.user.name)}. It was great to see you!`}</p>
<p style="margin:0 0 20px;color:#374151;font-size:14px">${fr ? 'Prêt pour votre prochain rendez-vous? Réservez-le en ligne en quelques secondes.' : 'Ready to book your next appointment? You can do it in seconds online.'}</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Réserver votre prochaine visite' : 'Book your next visit'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
        });
        await this.logNotification(apt.id, 'EMAIL', 'FOLLOW_UP', 'SENT');
        break;
      }

      case 'send-cancellation': {
        if (!shouldSend('emailCancellation')) {
          await this.logNotification(apt.id, 'EMAIL', 'CANCELLATION', 'SKIPPED', 'disabled_by_business');
          break;
        }
        const cancelIcs = generateICalCancellation({ id: apt.id, startsAt: apt.startsAt, endsAt: apt.endsAt, service: apt.service, business: apt.business });
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Rendez-vous annulé — ${apt.service.name}` : `Appointment cancelled — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">${fr ? 'Rendez-vous annulé' : 'Appointment cancelled'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, votre rendez-vous a été annulé.` : `Hi ${clientFirstName}, your appointment has been cancelled.`}</p>
${aptDetails(apt)}
${apt.cancelReason ? `<p style="margin:8px 0 0;color:#6B7280;font-size:13px">${fr ? 'Motif' : 'Reason'}: <em>${esc(apt.cancelReason)}</em></p>` : ''}
<a href="${webUrl}/book${fr ? '?lang=fr' : ''}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Prendre un nouveau rendez-vous' : 'Book a new appointment'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
          attachments: [{ filename: 'cancellation.ics', content: Buffer.from(cancelIcs).toString('base64'), content_type: 'text/calendar; method=CANCEL' }],
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `❌ Rendez-vous annulé : ${apt.service.name}, le ${aptDate(apt, 'yyyy-MM-dd')}${apt.cancelReason ? ' (Motif : ' + apt.cancelReason.replace(/[<>]/g, '') + ')' : ''}.`
          : `❌ Appointment cancelled: ${apt.service.name} on ${aptDate(apt, 'MMMM d, yyyy')}${apt.cancelReason ? ' (Reason: ' + apt.cancelReason.replace(/[<>]/g, '') + ')' : ''}.`);
        await this.notifyStaffAndOwners(apt.businessId, apt.staff.user.id, {
          kind: 'BOOKING_UPDATE',
          title: `Booking cancelled — ${apt.client.name}`,
          body: `${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}`,
          linkUrl: '/dashboard/appointments',
        });
        await this.logNotification(apt.id, 'EMAIL', 'CANCELLATION', 'SENT');
        break;
      }

      case 'send-staff-cancellation': {
        if (!shouldSend('emailStaffCancellation')) {
          await this.logNotification(apt.id, 'EMAIL', 'CANCELLATION', 'SKIPPED', 'disabled_by_business');
          break;
        }
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Votre rendez-vous a été annulé par ${apt.business.name}` : `Your appointment was cancelled by ${apt.business.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">${fr ? 'Rendez-vous annulé par l’entreprise' : 'Appointment cancelled by business'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, ${esc(apt.business.name)} a annulé votre rendez-vous. Nous sommes désolés des inconvénients.` : `Hi ${clientFirstName}, ${esc(apt.business.name)} has cancelled your appointment. We apologise for the inconvenience.`}</p>
${aptDetails(apt)}
${apt.cancelReason ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px 16px;margin:16px 0"><p style="margin:0;font-size:13px;color:#991B1B"><strong>${fr ? 'Motif' : 'Reason'}:</strong> ${esc(apt.cancelReason)}</p></div>` : ''}
<a href="${webUrl}/book/${apt.business.slug}${fr ? '?lang=fr' : ''}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Prendre un nouveau rendez-vous' : 'Rebook a new appointment'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `❌ Votre rendez-vous pour ${apt.service.name} a été annulé par ${apt.business.name}${apt.cancelReason ? ' (Motif : ' + apt.cancelReason.replace(/[<>]/g, '') + ')' : ''}.`
          : `❌ Your appointment for ${apt.service.name} was cancelled by ${apt.business.name}${apt.cancelReason ? ' (Reason: ' + apt.cancelReason.replace(/[<>]/g, '') + ')' : ''}.`);
        await this.logNotification(apt.id, 'EMAIL', 'CANCELLATION', 'SENT');
        break;
      }

      case 'send-reschedule': {
        if (!shouldSend('emailReschedule')) {
          await this.logNotification(apt.id, 'EMAIL', 'RESCHEDULE', 'SKIPPED', 'disabled_by_business');
          break;
        }
        const reschedIcs = generateICalEvent({
          id: apt.id,
          startsAt: apt.startsAt,
          endsAt: apt.endsAt,
          service: apt.service,
          staff: apt.staff,
          client: apt.client,
          business: apt.business,
          notes: apt.notes,
        });
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: fr ? `Rendez-vous reporté — ${apt.service.name}` : `Appointment rescheduled — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#E9A23C;font-size:20px;font-weight:700">${fr ? 'Rendez-vous reporté' : 'Appointment rescheduled'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${fr ? `Bonjour ${clientFirstName}, votre rendez-vous a été déplacé. Une invitation de calendrier mise à jour est jointe.` : `Hi ${clientFirstName}, your appointment has been moved to a new time. An updated calendar invite is attached.`}</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${fr ? 'Voir le rendez-vous' : 'View appointment'} →</a>
          `, undefined, fr ? 'fr' : 'en'),
          attachments: [{ filename: 'appointment.ics', content: Buffer.from(reschedIcs).toString('base64'), content_type: 'text/calendar; method=REQUEST' }],
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, fr
          ? `📅 Rendez-vous reporté : ${apt.service.name} est maintenant prévu le ${aptDate(apt, 'yyyy-MM-dd')} à ${aptDate(apt, 'HH:mm')}.`
          : `📅 Appointment rescheduled: ${apt.service.name} is now on ${aptDate(apt, 'MMMM d, yyyy')} at ${aptDate(apt, 'h:mm a')}.`);
        await this.notifyStaffAndOwners(apt.businessId, apt.staff.user.id, {
          kind: 'BOOKING_UPDATE',
          title: `Booking rescheduled — ${apt.client.name}`,
          body: `${apt.service.name} moved to ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}`,
          linkUrl: '/dashboard/appointments',
        });
        await this.logNotification(apt.id, 'EMAIL', 'RESCHEDULE', 'SENT');
        break;
      }

      case 'send-admin-booking-alert': {
        const adminEmail = apt.business.email || this.configService.get<string>('ADMIN_ALERT_EMAIL');
        const dashUrl = `${webUrl}/dashboard`;
        // Owner-facing copy follows the owner's language, not the client's.
        const owner = await this.prisma.user.findFirst({ where: { businessId: apt.businessId, role: 'OWNER' }, select: { locale: true } });
        const ownerFr = owner?.locale === 'fr';
        if (adminEmail) {
          await this.email.send({
            to: adminEmail,
            subject: ownerFr ? `Nouvelle réservation : ${apt.client.name} — ${apt.service.name}` : `New booking: ${apt.client.name} — ${apt.service.name}`,
            html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">${ownerFr ? 'Nouvelle réservation reçue' : 'New booking received'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${ownerFr ? 'Un nouveau rendez-vous a été réservé via votre page de réservation.' : 'A new appointment has been booked through your booking page.'}</p>
${aptDetails(apt)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">${ownerFr ? 'Client' : 'Client'}</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.client.name)} (${esc(apt.client.email)}${apt.client.phone ? ', ' + esc(apt.client.phone) : ''})</td></tr>
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">${ownerFr ? 'N° de réservation' : 'Booking ID'}</td><td style="color:#111827;font-size:12px;font-family:monospace">${apt.id}</td></tr>
</table>
<a href="${dashUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${ownerFr ? 'Voir dans le tableau de bord' : 'View in dashboard'} →</a>
            `, undefined, ownerFr ? 'fr' : 'en'),
          });
        }
        if (apt.business.phone) {
          await this.sms.send({
            to: apt.business.phone,
            body: ownerFr
              ? `Nouvelle réservation de ${apt.client.name} : ${apt.service.name} le ${aptDate(apt, 'yyyy-MM-dd')} à ${aptDate(apt, 'HH:mm')}. Voir : ${dashUrl}`
              : `New booking from ${apt.client.name}: ${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}. View: ${dashUrl}`,
          });
        }
        break;
      }

      case 'late-cancel-request': {
        const ownerEmail = apt.business.email || this.configService.get<string>('ADMIN_ALERT_EMAIL');
        const dashUrl = `${webUrl}/dashboard/appointments`;
        const owner = await this.prisma.user.findFirst({ where: { businessId: apt.businessId, role: 'OWNER' }, select: { locale: true } });
        const ownerFr = owner?.locale === 'fr';
        if (ownerEmail) {
          await this.email.send({
            to: ownerEmail,
            subject: ownerFr ? `Demande d’annulation tardive — ${apt.client.name}` : `Late cancellation request — ${apt.client.name}`,
            html: emailWrap(`
<h2 style="margin:0 0 4px;color:#D97706;font-size:20px;font-weight:700">${ownerFr ? 'Demande d’annulation tardive' : 'Late cancellation request'}</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${ownerFr ? `${esc(apt.client.name)} a demandé une annulation <strong>après</strong> votre délai de ${policyWindowLabel(apt.business.cancellationWindowMinutes ?? ((apt.business.cancellationWindowHours ?? 0) * 60))}. L’annulation en ligne a été bloquée et le client a été invité à communiquer avec vous. Vous décidez d’annuler le rendez-vous et de facturer ou non les frais.` : `${esc(apt.client.name)} asked to cancel <strong>after</strong> your ${policyWindowLabel(apt.business.cancellationWindowMinutes ?? ((apt.business.cancellationWindowHours ?? 0) * 60))} cancellation window, so the online cancel was blocked and they were asked to contact you. You decide whether to cancel and/or charge the fee.`}</p>
${aptDetails(apt)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Client</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.client.name)} (${esc(apt.client.email)}${apt.client.phone ? ', ' + esc(apt.client.phone) : ''})</td></tr>
</table>
<a href="${dashUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">${ownerFr ? 'Examiner dans le tableau de bord' : 'Review in dashboard'} →</a>
            `, undefined, ownerFr ? 'fr' : 'en'),
          });
        }
        await this.notifyOwners(apt.businessId, {
          kind: 'BOOKING_UPDATE',
          title: ownerFr ? `Demande d’annulation tardive — ${apt.client.name}` : `Late cancellation request — ${apt.client.name}`,
          body: ownerFr
            ? `${apt.service.name}, le ${aptDate(apt, 'yyyy-MM-dd')} à ${aptDate(apt, 'HH:mm')} — le client veut annuler après le délai`
            : `${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')} — client wants to cancel past the window`,
          linkUrl: '/dashboard/appointments',
        });
        break;
      }

    }
  }

  private logNotification(
    appointmentId: string,
    channel: 'EMAIL' | 'SMS',
    type: 'CONFIRMATION' | 'REMINDER_72H' | 'REMINDER_24H' | 'REMINDER_2H' | 'FOLLOW_UP' | 'CANCELLATION' | 'RESCHEDULE',
    status: 'SENT' | 'FAILED' | 'SKIPPED',
    errorMessage?: string,
  ) {
    return this.prisma.notificationLog.create({
      data: { appointmentId, channel, type, status, errorMessage },
    });
  }

  private async addInAppMessage(businessId: string, clientId: string, content: string) {
    await this.prisma.message.create({
      data: { businessId, clientId, content, fromClient: false },
    }).catch(err => this.logger.error(`Failed to add in-app message: ${err instanceof Error ? err.message : String(err)}`));
  }
}
