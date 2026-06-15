import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResendEmailProvider } from './providers/email.provider';
import { TwilioSmsProvider } from './providers/sms.provider';
import { NOTIFICATION_QUEUE } from './notifications.service';
import { effectivePlan } from '../common/util/plan';
import { isProPlan } from '../common/util/plan-features';
import { signAppointmentToken } from '../common/util/appointment-token';
import { formatInTimeZone } from 'date-fns-tz';
import { generateICalEvent, generateICalCancellation } from '../calendar-sync/ical.util';

// Escape user-controlled text before interpolating into email HTML — prevents
// HTML/markup injection via names, reasons, notes, gift-card messages, etc.
function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string,
  );
}

function emailWrap(content: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse</title></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden">
  <tr><td style="background:#E9A23C;padding:24px 32px">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px">Pulse</p>
  </td></tr>
  <tr><td style="padding:32px">${content}</td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #F3F4F6;background:#FAFAFA">
    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center">© Pulse · <a href="#" style="color:#E9A23C;text-decoration:none">Manage preferences</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

// Inline "Verified" pill for emails (solid colour — gradients are unreliable in
// mail clients). Empty string unless the business is admin-approved.
function verifiedPill(status?: string | null) {
  if (status !== 'VERIFIED') return '';
  return ` <span style="display:inline-block;background:#4F46E5;color:#fff;font-size:11px;font-weight:700;padding:1px 7px;border-radius:999px;vertical-align:middle">&#10003; Verified</span>`;
}

function aptDetails(apt: {
  service: { name: string; durationMinutes: number };
  staff: { user: { name: string } };
  business: { name?: string; timezone?: string | null; verificationStatus?: string | null };
  startsAt: Date; endsAt: Date;
}) {
  const tz = apt.business.timezone ?? 'UTC';
  const bizRow = apt.business.name
    ? `<tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Business</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.business.name)}${verifiedPill(apt.business.verificationStatus)}</td></tr>`
    : '';
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#F8F9FA;border-radius:12px">
  <tr><td style="padding:16px 20px">
    <table width="100%">
      ${bizRow}
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Service</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.service.name)} (${apt.service.durationMinutes} min)</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">With</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.staff.user.name)}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Date</td><td style="color:#111827;font-size:13px;font-weight:600">${formatInTimeZone(apt.startsAt, tz, 'EEEE, MMMM d, yyyy')}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Time</td><td style="color:#111827;font-size:13px;font-weight:600">${formatInTimeZone(apt.startsAt, tz, 'h:mm a')} - ${formatInTimeZone(apt.endsAt, tz, 'h:mm a')}</td></tr>
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

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
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
      const bookUrl = `${baseUrl}/book/${encodeURIComponent(c.business.slug)}`;
      await this.email.send({
        to: c.email,
        subject: `Happy birthday from ${c.business.name}! 🎉`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Happy birthday, ${esc(firstName(c.name))}! 🎂</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Everyone at <strong>${esc(c.business.name)}</strong> wishes you a wonderful day. Treat yourself — we'd love to help you celebrate.</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book a birthday treat →</a>
`),
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
      const bookUrl = `${baseUrl}/book/${encodeURIComponent(c.business.slug)}`;
      await this.email.send({
        to: c.email,
        subject: `We haven't seen you in a while — ${c.business.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">It's been a while 💛</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(c.name)}, it's been about three months since your last visit to <strong>${esc(c.business.name)}</strong>. We hope you're doing well — and we'd love to see you again!</p>
<p style="margin:0 0 20px;color:#374151;font-size:14px">Whenever you're ready, you can book your next visit online in a couple of taps.</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book your next visit →</a>
`),
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

  async process(job: Job<{ appointmentId?: string; expectedStartsAt?: string; messageId?: string; dueId?: string; waitlistEntryId?: string; campaignId?: string; clientId?: string; giftCardId?: string; userId?: string; resetToken?: string; ip?: string; userAgent?: string; otpCode?: string; otpMethod?: string; otpPhone?: string; businessId?: string; plan?: string; feeCents?: number }>) {
    if (process.env.NOTIFICATIONS_ENABLED === 'false') {
      console.warn(`[Notification skipped] NOTIFICATIONS_ENABLED=false job=${job.name} id=${job.id}`);
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
      const bookUrl = `${baseUrl}/book/${due.business.slug}`;
      const subject = due.messageSubject || `A follow-up from ${due.business.name}`;
      const body = due.messageBody || `It is time to book your next appointment with ${due.business.name}.`;
      if (due.client.email) await this.email.send({
        to: due.client.email,
        subject,
        html: emailWrap(`<p style="margin:0 0 18px;color:#374151;font-size:14px;white-space:pre-wrap">${esc(body)}</p><a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book follow-up</a>`),
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
        where: { businessId: message.businessId, role: { in: ['OWNER', 'STAFF'] } },
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
      if (job.data.otpMethod === 'SMS' && job.data.otpPhone) {
        await this.sms.send({ to: job.data.otpPhone, body: `Your Pulse verification code is ${code}. It expires in 10 minutes.` });
      } else {
        await this.email.send({
          to: user.email,
          subject: `Your Pulse verification code: ${code}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Your verification code</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(user.name)}, enter this code to finish signing in. It expires in 10 minutes.</p>
<div style="background:#FEF7EC;border:1px dashed #E9A23C;border-radius:12px;padding:18px;text-align:center;margin:0 0 8px">
  <p style="margin:0;color:#E9A23C;font-size:30px;font-weight:800;letter-spacing:6px">${code}</p>
</div>
<p style="margin:0;color:#9CA3AF;font-size:12px">If you didn't try to sign in, you can ignore this email.</p>
`),
        });
      }
      return;
    }

    // Email-verification link.
    if (job.name === 'verify-email') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user || !job.data.resetToken) return;
      this.currentBusinessId = user.businessId;
      const link = `${baseUrl}/verify-email?token=${job.data.resetToken}`;
      await this.email.send({
        to: user.email,
        subject: 'Verify your email for Pulse',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Confirm your email</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(user.name)}, please confirm this is your email address so you can view your bookings and messages.</p>
<a href="${link}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Verify email →</a>
<p style="margin:16px 0 0;color:#9CA3AF;font-size:12px">This link expires in 7 days. If you didn't create a Pulse account, you can ignore this email.</p>
`),
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
      const bizName = user.business?.name ?? 'your business';
      await this.email.send({
        to: user.email,
        subject: `Welcome to Pulse, ${user.name.split(' ')[0]}! 🎉`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Welcome aboard! 🎉</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(user.name)}, your account for <strong>${esc(bizName)}</strong> is ready. Here's how to get set up:</p>
<ol style="margin:0 0 16px;padding-left:20px;color:#374151;font-size:14px;line-height:1.7">
  <li>Add your services and prices</li>
  <li>Add your team and their availability</li>
  <li>Share your booking link and take your first appointment</li>
</ol>
<a href="${baseUrl}/dashboard" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Open your dashboard →</a>
`),
      });
      return;
    }

    // Password reset — email the single-use reset link.
    if (job.name === 'password-reset') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user || !job.data.resetToken) return;
      this.currentBusinessId = user.businessId;
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(job.data.resetToken)}`;
      await this.email.send({
        to: user.email,
        subject: 'Reset your Pulse password',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Reset your password</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(user.name)}, we received a request to reset your password. This link expires in 15 minutes. If you didn't ask for this, you can safely ignore this email.</p>
<a href="${resetUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Reset password →</a>
`),
      });
      return;
    }

    // Security alert — sign-in from a new device.
    if (job.name === 'security-alert') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user) return;
      this.currentBusinessId = user.businessId;
      const resetUrl = job.data.resetToken ? `${baseUrl}/reset-password?token=${encodeURIComponent(job.data.resetToken)}` : `${baseUrl}/forgot-password`;
      const device = esc((job.data.userAgent || 'an unrecognized device').slice(0, 120));
      const ip = job.data.ip ? ` (IP ${esc(job.data.ip)})` : '';
      await this.email.send({
        to: user.email,
        subject: '🔐 New sign-in to your Pulse account',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">New sign-in detected</h2>
<p style="margin:0 0 12px;color:#6B7280;font-size:14px">Hi ${esc(user.name)}, your Pulse account was just signed into from a device we haven't seen before:</p>
<p style="margin:0 0 16px;color:#374151;font-size:13px;background:#F8F9FA;border-radius:10px;padding:12px">${device}${ip}</p>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px"><strong>If this was you</strong>, you can ignore this email. <strong>If it wasn't</strong>, reset your password right away to secure your account.</p>
<a href="${resetUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Reset my password →</a>
`),
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
      const amount = `$${(card.initialCents / 100).toFixed(2)}`;
      await this.email.send({
        to: card.recipientEmail,
        subject: `You've received a ${amount} gift card for ${card.business.name}! 🎁`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">A gift just for you 🎁</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${card.purchaserName ? `${esc(card.purchaserName)} sent you` : "You've received"} a <strong>${esc(amount)}</strong> gift card for <strong>${esc(card.business.name)}</strong>.</p>
${card.message ? `<p style="margin:0 0 16px;color:#374151;font-size:14px;font-style:italic">"${esc(card.message)}"</p>` : ''}
<div style="background:#FEF7EC;border:1px dashed #E9A23C;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px">
  <p style="margin:0 0 4px;color:#6B7280;font-size:12px">Your gift card code</p>
  <p style="margin:0;color:#E9A23C;font-size:22px;font-weight:700;letter-spacing:1px">${esc(card.code)}</p>
</div>
<p style="margin:0;color:#6B7280;font-size:13px">Present this code when you book or visit ${esc(card.business.name)}.</p>
`),
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
      this.currentBusinessId = campaign.businessId;
      const merge = (t: string) => t.replace(/\{name\}/g, client.name).replace(/\{business\}/g, campaign.business.name); // raw: SMS + subject
      const mergeHtml = (t: string) => esc(t).replace(/\{name\}/g, esc(client.name)).replace(/\{business\}/g, esc(campaign.business.name));

      if (campaign.channel === 'SMS') {
        if (client.phone) await this.sms.send({ to: client.phone, body: merge(campaign.body) });
      } else if (client.email) {
        await this.email.send({
          to: client.email,
          subject: merge(campaign.subject ?? `A note from ${campaign.business.name}`),
          html: emailWrap(`<div style="color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${mergeHtml(campaign.body)}</div>`),
        });
      }
      await this.prisma.campaign.update({ where: { id: campaign.id }, data: { sentCount: { increment: 1 } } });
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
      const bookUrl = `${baseUrl}/book/${entry.business.slug}`;
      await this.email.send({
        to: entry.email,
        subject: `A spot just opened at ${entry.business.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">A spot just opened up! 🎉</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${entry.name}, a time just became available at <strong>${entry.business.name}</strong>. Book now before someone else grabs it.</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book now →</a>
`),
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
      const bookUrl = `${baseUrl}/book/${apt.business.slug}`;
      await this.email.send({
        to: apt.client.email,
        subject: `Payment failed — booking cancelled`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">Payment failed</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(firstName(apt.client.name))}, unfortunately your deposit payment for <strong>${esc(apt.service.name)}</strong> with <strong>${esc(apt.business.name)}</strong> could not be processed, and your booking has been cancelled.</p>
${aptDetails(apt)}
<p style="margin:16px 0 0;color:#6B7280;font-size:13px">Please check your card details and try booking again.</p>
<a href="${bookUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book again →</a>
`),
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
      const feeCents = job.data.feeCents ?? 0;
      const feeStr = `$${(feeCents / 100).toFixed(2)}`;
      await this.email.send({
        to: apt.client.email,
        subject: `No-show fee charged — ${apt.service.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">No-show fee of ${esc(feeStr)} charged</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(firstName(apt.client.name))}, a no-show fee has been charged to your card on file because your appointment was not attended and was not cancelled in advance.</p>
${aptDetails(apt)}
<p style="margin:16px 0 0;color:#6B7280;font-size:13px">If you have any questions, please contact <strong>${esc(apt.business.name)}</strong> directly.</p>
`),
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
      const feeCents = job.data.feeCents ?? 0;
      const feeStr = `$${(feeCents / 100).toFixed(2)}`;
      await this.email.send({
        to: apt.client.email,
        subject: `Late-cancellation fee charged — ${apt.service.name}`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Late-cancellation fee of ${esc(feeStr)} charged</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(firstName(apt.client.name))}, a late-cancellation fee has been applied to your card on file because your appointment was cancelled after the cancellation window set by <strong>${esc(apt.business.name)}</strong>.</p>
${aptDetails(apt)}
<p style="margin:16px 0 0;color:#6B7280;font-size:13px">If you believe this was charged in error, please contact <strong>${esc(apt.business.name)}</strong> directly.</p>
`),
      }).catch(() => {});
      return;
    }

    // Stripe Connect account approved — email the owner so they know they can take payments.
    if (job.name === 'connect-approved') {
      const businessId = job.data.businessId!;
      this.currentBusinessId = businessId;
      const owners = await this.prisma.user.findMany({ where: { businessId, role: 'OWNER' }, select: { email: true, name: true } });
      const dashUrl = `${baseUrl}/dashboard/settings`;
      for (const o of owners) {
        await this.email.send({
          to: o.email,
          subject: 'Your Stripe account is verified — you can now accept payments 🎉',
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Payments are live! 🎉</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(o.name)}, your Stripe account has been verified by Stripe. You can now accept deposits and card-on-file payments from clients — and payouts will be sent to your connected bank account on your Stripe payout schedule.</p>
<a href="${dashUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Go to settings →</a>
`),
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
      const bookUrl = `${baseUrl}/book/${client.business.slug}`;
      await this.email.send({
        to: client.email,
        subject: `We miss you at ${client.business.name}!`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">It's been a while...</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${esc(client.name)}, it's been a few weeks since your last visit to <strong>${esc(client.business.name)}</strong>. We'd love to see you again!</p>
<p style="margin:0 0 20px;color:#374151;font-size:14px">Ready for your next appointment? You can book instantly online.</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book your next visit →</a>
`),
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

    // Subscription plan changed → email + in-app confirmation to the owner.
    if (job.name === 'plan-changed') {
      await this.sendPlanChangedEmail(String(job.data.businessId ?? ''), String(job.data.plan ?? 'FREE'));
      return;
    }

    const apt = await this.prisma.appointment.findUnique({
      where: { id: job.data.appointmentId! },
      include: { client: true, service: true, staff: { include: { user: true } }, business: true },
    });

    if (!apt) return;
    this.currentBusinessId = apt.businessId;
    const clientFirstName = esc(firstName(apt.client.name));

    const smsEnabled = isProPlan(apt.business.plan);
    const settings = apt.business.notificationSettings;
    const shouldSend = (key: NotificationKey) => notificationEnabled(settings, key);

    const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    // HMAC manage token so the link proves the recipient got the email (the
    // public booking endpoints reject an id without a valid token).
    const manageUrl = `${webUrl}/appointments/${apt.id}/manage#token=${encodeURIComponent(signAppointmentToken(apt.id))}`;

    switch (job.name) {

      case 'review-request': {
        if (!apt.client.email) break;
        await this.email.send({
          to: apt.client.email,
          subject: `How was your visit to ${apt.business.name}?`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">How did we do? ⭐</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, thanks for visiting <strong>${apt.business.name}</strong>. We'd love your feedback on your ${apt.service.name} with ${apt.staff.user.name}.</p>
<a href="${baseUrl}/review/${apt.id}#token=${encodeURIComponent(signAppointmentToken(apt.id, 7 * 24 * 60 * 60))}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Leave a review →</a>
`),
        });
        break;
      }

      case 'send-pending': {
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: `Booking request received — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Booking request received ⏳</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, your booking request has been received and is awaiting approval from <strong>${apt.business.name}</strong>. You'll get a confirmation email once it's approved.</p>
${aptDetails(apt)}
<p style="margin:8px 0 0;color:#6B7280;font-size:13px">We'll notify you as soon as your appointment is confirmed.</p>
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View booking →</a>
          `),
        });
        if (apt.client.phone && smsEnabled) {
          await this.sms.send({
            to: apt.client.phone,
            body: `Booking request received by ${apt.business.name}: ${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}. ${manageUrl}`,
          });
        }
        await this.addInAppMessage(apt.businessId, apt.clientId, `⏳ Booking request received for ${apt.service.name} on ${aptDate(apt, 'MMMM d, yyyy')} at ${aptDate(apt, 'h:mm a')}. Awaiting approval.`);
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
        });
        const icsAttachment = {
          filename: 'appointment.ics',
          content: Buffer.from(icsContent).toString('base64'),
          content_type: 'text/calendar; method=REQUEST',
        };
        const hasCardOnFile = !!apt.stripePaymentMethodId;
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: `Appointment confirmed — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">You're booked! ✓</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, your appointment is confirmed.</p>
${aptDetails(apt)}
<p style="margin:0;color:#6B7280;font-size:13px">You'll receive a reminder 24 hours before your appointment. A calendar invite is attached to this email.</p>
${hasCardOnFile ? `<p style="margin:12px 0 0;color:#6B7280;font-size:12px">💳 A card is saved on file for this booking (for no-show/cancellation protection). You can remove it anytime from your <a href="${webUrl}/my/dashboard" style="color:#7C3AED">client portal</a>.</p>` : ''}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage appointment →</a>
          `),
          attachments: [icsAttachment],
        });
        if (apt.client.phone && smsEnabled && shouldSend('smsConfirmation')) {
          await this.sms.send({
            to: apt.client.phone,
            body: `Confirmed with ${apt.business.name}: ${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}. ${manageUrl}`,
          });
        }
        await this.addInAppMessage(apt.businessId, apt.clientId, `✅ Appointment confirmed: ${apt.service.name} on ${aptDate(apt, 'MMMM d, yyyy')} at ${aptDate(apt, 'h:mm a')}.`);
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
          subject: `Reminder: ${apt.service.name} in 3 days`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Coming up in 3 days</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, a heads-up about your upcoming appointment.</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `📅 Reminder: You have an appointment for ${apt.service.name} in 3 days at ${aptDate(apt, 'h:mm a')}.`);
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
          subject: `Reminder: ${apt.service.name} tomorrow`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">See you tomorrow!</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, just a friendly reminder about your upcoming appointment.</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `⏰ Reminder: You have an appointment for ${apt.service.name} tomorrow at ${aptDate(apt, 'h:mm a')}.`);
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
          await this.sms.send({
            to: apt.client.phone,
            body: `Reminder: ${apt.service.name} with ${apt.staff.user.name} in 2 hours at ${aptDate(apt, 'h:mm a')}. ${manageUrl}`,
          });
          await this.logNotification(apt.id, 'SMS', 'REMINDER_2H', 'SENT');
        }
        await this.addInAppMessage(apt.businessId, apt.clientId, `🔔 Reminder: Your appointment for ${apt.service.name} is in 2 hours.`);
        break;
      }

      case 'follow-up-post-apt': {
        if (apt.status !== 'COMPLETED') break;
        if (!shouldSend('emailFollowUp')) {
          await this.logNotification(apt.id, 'EMAIL', 'FOLLOW_UP', 'SKIPPED', 'disabled_by_business');
          break;
        }
        const bookUrl = `${webUrl}/book/${apt.business.slug ?? ''}`;
        if (apt.client.email) await this.email.send({
          to: apt.client.email,
          subject: `Thanks for visiting ${apt.business.name}!`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Thanks for your visit!</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, we hope you enjoyed your ${apt.service.name} with ${apt.staff.user.name}. It was great to see you!</p>
<p style="margin:0 0 20px;color:#374151;font-size:14px">Ready to book your next appointment? You can do it in seconds online.</p>
<a href="${bookUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book your next visit →</a>
          `),
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
          subject: `Appointment cancelled — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">Appointment cancelled</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, your appointment has been cancelled.</p>
${aptDetails(apt)}
${apt.cancelReason ? `<p style="margin:8px 0 0;color:#6B7280;font-size:13px">Reason: <em>${esc(apt.cancelReason)}</em></p>` : ''}
<a href="${webUrl}/book" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book a new appointment →</a>
          `),
          attachments: [{ filename: 'cancellation.ics', content: Buffer.from(cancelIcs).toString('base64'), content_type: 'text/calendar; method=CANCEL' }],
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `❌ Appointment cancelled: ${apt.service.name} on ${aptDate(apt, 'MMMM d, yyyy')}${apt.cancelReason ? ' (Reason: ' + apt.cancelReason + ')' : ''}.`);
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
          subject: `Your appointment was cancelled by ${apt.business.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">Appointment cancelled by business</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, ${apt.business.name} has cancelled your appointment. We apologise for the inconvenience.</p>
${aptDetails(apt)}
${apt.cancelReason ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px 16px;margin:16px 0"><p style="margin:0;font-size:13px;color:#991B1B"><strong>Reason:</strong> ${esc(apt.cancelReason)}</p></div>` : ''}
<a href="${webUrl}/book" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Rebook a new appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `❌ Your appointment for ${apt.service.name} was cancelled by ${apt.business.name}${apt.cancelReason ? ' (Reason: ' + apt.cancelReason + ')' : ''}.`);
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
          subject: `Appointment rescheduled — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#E9A23C;font-size:20px;font-weight:700">Appointment rescheduled</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${clientFirstName}, your appointment has been moved to a new time. An updated calendar invite is attached.</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View appointment →</a>
          `),
          attachments: [{ filename: 'appointment.ics', content: Buffer.from(reschedIcs).toString('base64'), content_type: 'text/calendar; method=REQUEST' }],
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `📅 Appointment rescheduled: ${apt.service.name} is now on ${aptDate(apt, 'MMMM d, yyyy')} at ${aptDate(apt, 'h:mm a')}.`);
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
        if (adminEmail) {
          await this.email.send({
            to: adminEmail,
            subject: `New booking: ${apt.client.name} — ${apt.service.name}`,
            html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">New booking received</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">A new appointment has been booked through your booking page.</p>
${aptDetails(apt)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Client</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.client.name)} (${esc(apt.client.email)}${apt.client.phone ? ', ' + esc(apt.client.phone) : ''})</td></tr>
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Booking ID</td><td style="color:#111827;font-size:12px;font-family:monospace">${apt.id}</td></tr>
</table>
<a href="${dashUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View in dashboard →</a>
            `),
          });
        }
        if (apt.business.phone) {
          await this.sms.send({
            to: apt.business.phone,
            body: `New booking from ${apt.client.name}: ${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')}. View: ${dashUrl}`,
          });
        }
        break;
      }

      case 'late-cancel-request': {
        const ownerEmail = apt.business.email || this.configService.get<string>('ADMIN_ALERT_EMAIL');
        const dashUrl = `${webUrl}/dashboard/appointments`;
        if (ownerEmail) {
          await this.email.send({
            to: ownerEmail,
            subject: `Late cancellation request — ${apt.client.name}`,
            html: emailWrap(`
<h2 style="margin:0 0 4px;color:#D97706;font-size:20px;font-weight:700">Late cancellation request</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${apt.client.name} asked to cancel <strong>after</strong> your ${policyWindowLabel(apt.business.cancellationWindowMinutes ?? ((apt.business.cancellationWindowHours ?? 0) * 60))} cancellation window, so the online cancel was blocked and they were asked to contact you. You decide whether to cancel and/or charge the fee.</p>
${aptDetails(apt)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Client</td><td style="color:#111827;font-size:13px;font-weight:600">${esc(apt.client.name)} (${esc(apt.client.email)}${apt.client.phone ? ', ' + esc(apt.client.phone) : ''})</td></tr>
</table>
<a href="${dashUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Review in dashboard →</a>
            `),
          });
        }
        await this.notifyOwners(apt.businessId, {
          kind: 'BOOKING_UPDATE',
          title: `Late cancellation request — ${apt.client.name}`,
          body: `${apt.service.name} on ${aptDate(apt, 'MMM d')} at ${aptDate(apt, 'h:mm a')} — client wants to cancel past the window`,
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
    }).catch(err => console.error('Failed to add in-app message:', err instanceof Error ? err.message : String(err)));
  }
}
