import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ResendEmailProvider } from './providers/email.provider';
import { TwilioSmsProvider } from './providers/sms.provider';
import { NOTIFICATION_QUEUE } from './notifications.service';
import { format } from 'date-fns';

function emailWrap(content: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BookingApp</title></head>
<body style="margin:0;padding:0;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #E5E7EB;overflow:hidden">
  <tr><td style="background:#7C3AED;padding:24px 32px">
    <p style="margin:0;color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.3px">BookingApp</p>
  </td></tr>
  <tr><td style="padding:32px">${content}</td></tr>
  <tr><td style="padding:16px 32px;border-top:1px solid #F3F4F6;background:#FAFAFA">
    <p style="margin:0;color:#9CA3AF;font-size:12px;text-align:center">© BookingApp · <a href="#" style="color:#7C3AED;text-decoration:none">Manage preferences</a></p>
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

  async process(job: Job<{ appointmentId: string }>) {
    const apt = await this.prisma.appointment.findUnique({
      where: { id: job.data.appointmentId },
      include: { client: true, service: true, staff: { include: { user: true } }, business: true },
    });

    if (!apt) return;

    // Gate SMS reminders behind PRO plan
    const isPro = apt.business.plan === 'PRO';

    const webUrl = this.configService.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    const manageUrl = `${webUrl}/appointments/${apt.id}/manage`;

    switch (job.name) {

      case 'send-pending': {
        await this.email.send({
          to: apt.client.email,
          subject: `Booking request received — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#111827;font-size:20px;font-weight:700">Booking request received ⏳</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, your booking request has been received and is awaiting approval from <strong>${apt.business.name}</strong>. You'll get a confirmation email once it's approved.</p>
${aptDetails(apt)}
<p style="margin:8px 0 0;color:#6B7280;font-size:13px">We'll notify you as soon as your appointment is confirmed.</p>
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View booking →</a>
          `),
        });
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
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage appointment →</a>
          `),
        });
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
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Manage appointment →</a>
          `),
        });
        await this.logNotification(apt.id, 'EMAIL', 'REMINDER_24H', 'SENT');
        break;
      }

      case 'reminder-2h': {
        if (apt.status === 'CANCELLED') break;
        if (apt.client.phone && isPro) {
          await this.sms.send({
            to: apt.client.phone,
            body: `Reminder: ${apt.service.name} with ${apt.staff.user.name} in 2 hours at ${format(apt.startsAt, 'h:mm a')}. ${manageUrl}`,
          });
          await this.logNotification(apt.id, 'SMS', 'REMINDER_2H', 'SENT');
        }
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
<a href="${webUrl}/book" style="display:inline-block;margin-top:20px;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Book a new appointment →</a>
          `),
        });
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
<a href="${webUrl}/book" style="display:inline-block;margin-top:20px;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">Rebook a new appointment →</a>
          `),
        });
        await this.logNotification(apt.id, 'EMAIL', 'CANCELLATION', 'SENT');
        break;
      }

      case 'send-reschedule': {
        await this.email.send({
          to: apt.client.email,
          subject: `Appointment rescheduled — ${apt.service.name}`,
          html: emailWrap(`
<h2 style="margin:0 0 4px;color:#7C3AED;font-size:20px;font-weight:700">Appointment rescheduled</h2>
<p style="margin:0 0 16px;color:#6B7280;font-size:14px">Hi ${apt.client.name}, your appointment has been moved to a new time.</p>
${aptDetails(apt)}
<a href="${manageUrl}" style="display:inline-block;margin-top:20px;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View appointment →</a>
          `),
        });
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
<a href="${dashUrl}" style="display:inline-block;margin-top:20px;background:#7C3AED;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600">View in dashboard →</a>
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
}
