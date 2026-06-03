import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResendEmailProvider } from './providers/email.provider';
import { TwilioSmsProvider } from './providers/sms.provider';
import { NOTIFICATION_QUEUE } from './notifications.service';
import { signAppointmentToken } from '../common/util/appointment-token';
import { format } from 'date-fns';

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

function aptDetails(apt: {
  service: { name: string; durationMinutes: number };
  staff: { user: { name: string } };
  startsAt: Date; endsAt: Date;
}) {
  return `
<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;background:#F8F9FA;border-radius:12px">
  <tr><td style="padding:16px 20px">
    <table width="100%">
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Service</td><td style="color:#111827;font-size:13px;font-weight:600">${apt.service.name} (${apt.service.durationMinutes} min)</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">With</td><td style="color:#111827;font-size:13px;font-weight:600">${apt.staff.user.name}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Date</td><td style="color:#111827;font-size:13px;font-weight:600">${format(apt.startsAt, 'EEEE, MMMM d, yyyy')}</td></tr>
      <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Time</td><td style="color:#111827;font-size:13px;font-weight:600">${format(apt.startsAt, 'h:mm a')} – ${format(apt.endsAt, 'h:mm a')}</td></tr>
    </table>
  </td></tr>
</table>`;
}

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  private email = new ResendEmailProvider();
  private sms   = new TwilioSmsProvider();

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) { super(); }

  async process(job: Job<{ appointmentId?: string; waitlistEntryId?: string; campaignId?: string; clientId?: string; giftCardId?: string; userId?: string; resetToken?: string; ip?: string; userAgent?: string; otpCode?: string; otpMethod?: string }>) {
    const baseUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';

    // 2FA one-time code (email, or SMS if the method is SMS and a phone exists).
    if (job.name === 'otp') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user || !job.data.otpCode) return;
      const code = job.data.otpCode;
      if (job.data.otpMethod === 'SMS' && user.phone) {
        await this.sms.send({ to: user.phone, body: `Your Pulse verification code is ${code}. It expires in 10 minutes.` });
      } else {
        await this.email.send({
          to: user.email,
          subject: `Your Pulse verification code: ${code}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Your verification code</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${user.name}, enter this code to finish signing in. It expires in 10 minutes.</p>
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
      const link = `${baseUrl}/verify-email?token=${job.data.resetToken}`;
      await this.email.send({
        to: user.email,
        subject: 'Verify your email for Pulse',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Confirm your email</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${user.name}, please confirm this is your email address so you can view your bookings and messages.</p>
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
      const bizName = user.business?.name ?? 'your business';
      await this.email.send({
        to: user.email,
        subject: `Welcome to Pulse, ${user.name.split(' ')[0]}! 🎉`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Welcome aboard! 🎉</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${user.name}, your account for <strong>${bizName}</strong> is ready. Here's how to get set up:</p>
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
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(job.data.resetToken)}`;
      await this.email.send({
        to: user.email,
        subject: 'Reset your Pulse password',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Reset your password</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${user.name}, we received a request to reset your password. This link expires in 30 minutes. If you didn't ask for this, you can safely ignore this email.</p>
<a href="${resetUrl}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Reset password →</a>
`),
      });
      return;
    }

    // Security alert — sign-in from a new device.
    if (job.name === 'security-alert') {
      const user = await this.prisma.user.findUnique({ where: { id: job.data.userId! } });
      if (!user) return;
      const resetUrl = job.data.resetToken ? `${baseUrl}/reset-password?token=${encodeURIComponent(job.data.resetToken)}` : `${baseUrl}/forgot-password`;
      const device = (job.data.userAgent || 'an unrecognized device').slice(0, 120);
      const ip = job.data.ip ? ` (IP ${job.data.ip})` : '';
      await this.email.send({
        to: user.email,
        subject: '🔐 New sign-in to your Pulse account',
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">New sign-in detected</h2>
<p style="margin:0 0 12px;color:#6B7280;font-size:14px">Hi ${user.name}, your Pulse account was just signed into from a device we haven't seen before:</p>
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
      const amount = `$${(card.initialCents / 100).toFixed(2)}`;
      await this.email.send({
        to: card.recipientEmail,
        subject: `You've received a ${amount} gift card for ${card.business.name}! 🎁`,
        html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">A gift just for you 🎁</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">${card.purchaserName ? `${card.purchaserName} sent you` : "You've received"} a <strong>${amount}</strong> gift card for <strong>${card.business.name}</strong>.</p>
${card.message ? `<p style="margin:0 0 16px;color:#374151;font-size:14px;font-style:italic">"${card.message}"</p>` : ''}
<div style="background:#FEF7EC;border:1px dashed #E9A23C;border-radius:12px;padding:16px;text-align:center;margin:0 0 16px">
  <p style="margin:0 0 4px;color:#6B7280;font-size:12px">Your gift card code</p>
  <p style="margin:0;color:#E9A23C;font-size:22px;font-weight:700;letter-spacing:1px">${card.code}</p>
</div>
<p style="margin:0;color:#6B7280;font-size:13px">Present this code when you book or visit ${card.business.name}.</p>
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
      const merge = (t: string) => t.replace(/\{name\}/g, client.name).replace(/\{business\}/g, campaign.business.name);

      if (campaign.channel === 'SMS') {
        if (client.phone) await this.sms.send({ to: client.phone, body: merge(campaign.body) });
      } else {
        await this.email.send({
          to: client.email,
          subject: merge(campaign.subject ?? `A note from ${campaign.business.name}`),
          html: emailWrap(`<div style="color:#374151;font-size:14px;line-height:1.6;white-space:pre-wrap">${merge(campaign.body)}</div>`),
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

    const apt = await this.prisma.appointment.findUnique({
      where: { id: job.data.appointmentId! },
      include: { client: true, service: true, staff: { include: { user: true } }, business: true },
    });

    if (!apt) return;

    // SMS reminders are a PAID-plan feature (BASIC + PRO). Free tier gets email
    // reminders only — no texts to clients.
    const smsEnabled = apt.business.plan !== 'FREE';

    const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    // HMAC manage token so the link proves the recipient got the email (the
    // public booking endpoints reject an id without a valid token).
    const manageUrl = `${webUrl}/appointments/${apt.id}/manage?token=${signAppointmentToken(apt.id)}`;

    switch (job.name) {

      case 'review-request': {
        await this.email.send({
          to: apt.client.email,
          subject: `How was your visit to ${apt.business.name}?`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">How did we do? ⭐</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, thanks for visiting <strong>${apt.business.name}</strong>. We'd love your feedback on your ${apt.service.name} with ${apt.staff.user.name}.</p>
<a href="${baseUrl}/review/${apt.id}?token=${signAppointmentToken(apt.id)}" style="display:inline-block;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Leave a review →</a>
`),
        });
        break;
      }

      case 'send-pending': {
        await this.email.send({
          to: apt.client.email,
          subject: `Booking request received — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Booking request received ⏳</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, your booking request has been received and is awaiting approval from <strong>${apt.business.name}</strong>. You'll get a confirmation email once it's approved.</p>
${aptDetails(apt)}
<p style="margin:8px 0 0;color:#6B7280;font-size:13px">We'll notify you as soon as your appointment is confirmed.</p>
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View booking →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `⏳ Booking request received for ${apt.service.name} on ${format(apt.startsAt, 'MMMM d, yyyy')} at ${format(apt.startsAt, 'h:mm a')}. Awaiting approval.`);
        await this.logNotification(apt.id, 'EMAIL', 'CONFIRMATION', 'SENT');
        break;
      }

      case 'send-confirmation': {
        await this.email.send({
          to: apt.client.email,
          subject: `Appointment confirmed — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">You're booked! ✓</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, your appointment is confirmed.</p>
${aptDetails(apt)}
<p style="margin:0;color:#6B7280;font-size:13px">You'll receive a reminder 24 hours before your appointment.</p>
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `✅ Appointment confirmed: ${apt.service.name} on ${format(apt.startsAt, 'MMMM d, yyyy')} at ${format(apt.startsAt, 'h:mm a')}.`);
        await this.logNotification(apt.id, 'EMAIL', 'CONFIRMATION', 'SENT');
        break;
      }

      case 'reminder-24h': {
        if (apt.status === 'CANCELLED') break;
        await this.email.send({
          to: apt.client.email,
          subject: `Reminder: ${apt.service.name} tomorrow`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">See you tomorrow!</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, just a friendly reminder about your upcoming appointment.</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `⏰ Reminder: You have an appointment for ${apt.service.name} tomorrow at ${format(apt.startsAt, 'h:mm a')}.`);
        await this.logNotification(apt.id, 'EMAIL', 'REMINDER_24H', 'SENT');
        break;
      }

      case 'reminder-2h': {
        if (apt.status === 'CANCELLED') break;
        if (apt.client.phone && smsEnabled) {
          await this.sms.send({
            to: apt.client.phone,
            body: `Reminder: ${apt.service.name} with ${apt.staff.user.name} in 2 hours at ${format(apt.startsAt, 'h:mm a')}. ${manageUrl}`,
          });
          await this.logNotification(apt.id, 'SMS', 'REMINDER_2H', 'SENT');
        }
        await this.addInAppMessage(apt.businessId, apt.clientId, `🔔 Reminder: Your appointment for ${apt.service.name} is in 2 hours.`);
        break;
      }

      case 'send-cancellation': {
        await this.email.send({
          to: apt.client.email,
          subject: `Appointment cancelled — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">Appointment cancelled</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, your appointment has been cancelled.</p>
${aptDetails(apt)}
${apt.cancelReason ? `<p style="margin:8px 0 0;color:#6B7280;font-size:13px">Reason: <em>${apt.cancelReason}</em></p>` : ''}
<a href="${webUrl}/book" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book a new appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `❌ Appointment cancelled: ${apt.service.name} on ${format(apt.startsAt, 'MMMM d, yyyy')}${apt.cancelReason ? ' (Reason: ' + apt.cancelReason + ')' : ''}.`);
        await this.logNotification(apt.id, 'EMAIL', 'CANCELLATION', 'SENT');
        break;
      }

      case 'send-staff-cancellation': {
        await this.email.send({
          to: apt.client.email,
          subject: `Your appointment was cancelled by ${apt.business.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#EF4444;font-size:20px;font-weight:700">Appointment cancelled by business</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, ${apt.business.name} has cancelled your appointment. We apologise for the inconvenience.</p>
${aptDetails(apt)}
${apt.cancelReason ? `<div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px 16px;margin:16px 0"><p style="margin:0;font-size:13px;color:#991B1B"><strong>Reason:</strong> ${apt.cancelReason}</p></div>` : ''}
<a href="${webUrl}/book" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Rebook a new appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `❌ Your appointment for ${apt.service.name} was cancelled by ${apt.business.name}${apt.cancelReason ? ' (Reason: ' + apt.cancelReason + ')' : ''}.`);
        await this.logNotification(apt.id, 'EMAIL', 'CANCELLATION', 'SENT');
        break;
      }

      case 'send-reschedule': {
        await this.email.send({
          to: apt.client.email,
          subject: `Appointment rescheduled — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#E9A23C;font-size:20px;font-weight:700">Appointment rescheduled</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, your appointment has been moved to a new time.</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View appointment →</a>
          `),
        });
        await this.addInAppMessage(apt.businessId, apt.clientId, `📅 Appointment rescheduled: ${apt.service.name} is now on ${format(apt.startsAt, 'MMMM d, yyyy')} at ${format(apt.startsAt, 'h:mm a')}.`);
        await this.logNotification(apt.id, 'EMAIL', 'RESCHEDULE', 'SENT');
        break;
      }

      case 'send-admin-booking-alert': {
        const adminEmail = apt.business.email || this.configService.get<string>('ADMIN_ALERT_EMAIL');
        if (!adminEmail) break;
        const dashUrl = `${webUrl}/dashboard`;
        await this.email.send({
          to: adminEmail,
          subject: `New booking: ${apt.client.name} — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">New booking received</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">A new appointment has been booked through your booking page.</p>
${aptDetails(apt)}
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:110px">Client</td><td style="color:#111827;font-size:13px;font-weight:600">${apt.client.name} (${apt.client.email}${apt.client.phone ? ', ' + apt.client.phone : ''})</td></tr>
  <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Booking ID</td><td style="color:#111827;font-size:12px;font-family:monospace">${apt.id}</td></tr>
</table>
<a href="${dashUrl}" style="display:inline-block;margin-top:20px;background:#E9A23C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View in dashboard →</a>
          `),
        });
        break;
      }

    }
  }

  private logNotification(
    appointmentId: string,
    channel: 'EMAIL' | 'SMS',
    type: 'CONFIRMATION' | 'REMINDER_24H' | 'REMINDER_2H' | 'CANCELLATION' | 'RESCHEDULE',
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
    }).catch(err => console.error('Failed to add in-app message:', err));
  }
}
