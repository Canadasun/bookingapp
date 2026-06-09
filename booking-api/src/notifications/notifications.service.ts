import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { isPaidPlan, isProPlan } from '../common/util/plan-features';

export const NOTIFICATION_QUEUE = 'notifications';

export interface AppointmentWithRelations {
  id: string;
  startsAt: Date;
  endsAt: Date;
  client: { name: string; email: string | null; phone?: string | null };
  service: { name: string };
  business?: { plan: 'FREE' | 'BASIC' | 'PRO' | 'UNLIMITED'; notificationSettings?: unknown };
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

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private queue: Queue,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  // Register the daily lapsed-client win-back scan. Idempotent (BullMQ dedupes
  // repeatable jobs by name+pattern); best-effort so a Redis hiccup can't block boot.
  async onModuleInit() {
    try {
      await this.queue.add('winback-scan', {}, {
        repeat: { pattern: '0 14 * * *' }, // 14:00 UTC daily
        removeOnComplete: true,
        removeOnFail: true,
      });
      await this.queue.add('service-due-scan', {}, {
        repeat: { pattern: '0 13 * * *' }, // 13:00 UTC daily
        removeOnComplete: true,
        removeOnFail: true,
      });
      await this.queue.add('birthday-scan', {}, {
        repeat: { pattern: '0 15 * * *' }, // 15:00 UTC daily
        removeOnComplete: true,
        removeOnFail: true,
      });
    } catch (e) {
      this.logger.warn(`Could not schedule scans: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Confirm a subscription plan change (upgrade/downgrade/cancel) to the owner(s).
  async sendPlanChanged(businessId: string, plan: string) {
    await this.queue.add('plan-changed', { businessId, plan }, {
      jobId: `plan-${businessId}-${Date.now()}`,
      removeOnComplete: true,
      attempts: 1,
    });
  }

  // Invite a lapsed/due client to book their next visit (reuses the win-back email).
  async sendRebookNudge(clientId: string) {
    await this.queue.add('rebook-reminder', { clientId }, {
      jobId: `rebook-${clientId}-${Date.now()}`,
      removeOnComplete: true,
      attempts: 1,
    });
  }

  async sendCustomFollowUp(dueId: string) {
    await this.queue.add('custom-follow-up', { dueId }, {
      jobId: `follow-up-${dueId}`,
      removeOnComplete: true,
      attempts: 2,
      backoff: { type: 'exponential', delay: 3000 },
    });
  }

  async scheduleReminders(apt: AppointmentWithRelations) {
    const business = apt.business ?? await this.prisma.appointment
      .findUnique({ where: { id: apt.id }, select: { business: { select: { plan: true, notificationSettings: true } } } })
      .then((row) => row?.business);
    const now = Date.now();
    const delay72h = apt.startsAt.getTime() - now - 72 * 60 * 60 * 1000;
    const delay24h = apt.startsAt.getTime() - now - 24 * 60 * 60 * 1000;
    const delay2h  = apt.startsAt.getTime() - now -  2 * 60 * 60 * 1000;
    // 24h after the appointment ends
    const delayFollowUp = apt.endsAt.getTime() - now + 24 * 60 * 60 * 1000;

    if (delay72h > 0 && isProPlan(business?.plan) && this.enabled(business?.notificationSettings, 'emailReminder72h')) {
      await this.queue.add(
        'reminder-72h',
        { appointmentId: apt.id, expectedStartsAt: apt.startsAt.toISOString() },
        { delay: delay72h, jobId: `reminder-72h-${apt.id}`, removeOnComplete: true },
      );
    }
    if (delay24h > 0 && isPaidPlan(business?.plan) && this.enabled(business?.notificationSettings, 'emailReminder24h')) {
      await this.queue.add(
        'reminder-24h',
        { appointmentId: apt.id, expectedStartsAt: apt.startsAt.toISOString() },
        { delay: delay24h, jobId: `reminder-24h-${apt.id}`, removeOnComplete: true },
      );
    }
    if (delay2h > 0 && isProPlan(business?.plan) && this.enabled(business?.notificationSettings, 'smsReminder2h')) {
      await this.queue.add(
        'reminder-2h',
        { appointmentId: apt.id, expectedStartsAt: apt.startsAt.toISOString() },
        { delay: delay2h, jobId: `reminder-2h-${apt.id}`, removeOnComplete: true },
      );
    }
    if (delayFollowUp > 0 && isPaidPlan(business?.plan) && this.enabled(business?.notificationSettings, 'emailFollowUp')) {
      await this.queue.add(
        'follow-up-post-apt',
        { appointmentId: apt.id },
        { delay: delayFollowUp, jobId: `follow-up-post-apt-${apt.id}`, removeOnComplete: true },
      );
    }

    await this.sendConfirmation(apt);
  }

  private dedupe(name: string, id: string) {
    return `${name}-${id}`;
  }

  private enabled(settings: unknown, key: NotificationKey) {
    return !settings || typeof settings !== 'object' || (settings as Record<string, unknown>)[key] !== false;
  }

  private async appointmentSettingEnabled(apt: AppointmentWithRelations, key: NotificationKey) {
    const settings = apt.business?.notificationSettings ?? await this.prisma.appointment
      .findUnique({ where: { id: apt.id }, select: { business: { select: { notificationSettings: true } } } })
      .then((row) => row?.business.notificationSettings);
    return this.enabled(settings, key);
  }

  async cancelReminders(appointmentId: string) {
    const jobs = await Promise.allSettled([
      this.queue.remove(`reminder-72h-${appointmentId}`),
      this.queue.remove(`reminder-24h-${appointmentId}`),
      this.queue.remove(`reminder-2h-${appointmentId}`),
      this.queue.remove(`follow-up-post-apt-${appointmentId}`),
    ]);
    return jobs;
  }

  async sendConfirmation(apt: AppointmentWithRelations) {
    if (!(await this.appointmentSettingEnabled(apt, 'emailConfirmation'))) return;
    await this.queue.add('send-confirmation', { appointmentId: apt.id }, { jobId: `${this.dedupe('send-confirmation', apt.id)}-${Date.now()}` });
  }

  async sendPendingNotification(apt: AppointmentWithRelations) {
    await this.queue.add('send-pending', { appointmentId: apt.id }, { jobId: this.dedupe('send-pending', apt.id) });
  }

  async sendCancellation(apt: AppointmentWithRelations) {
    if (!(await this.appointmentSettingEnabled(apt, 'emailCancellation'))) return;
    await this.queue.add('send-cancellation', { appointmentId: apt.id }, { jobId: this.dedupe('send-cancellation', apt.id) });
  }

  async sendReschedule(apt: AppointmentWithRelations) {
    if (!(await this.appointmentSettingEnabled(apt, 'emailReschedule'))) return;
    await this.queue.add('send-reschedule', { appointmentId: apt.id }, { jobId: `${this.dedupe('send-reschedule', apt.id)}-${apt.startsAt.getTime()}` });
  }

  async sendStaffCancellation(apt: AppointmentWithRelations) {
    if (!(await this.appointmentSettingEnabled(apt, 'emailStaffCancellation'))) return;
    await this.queue.add('send-staff-cancellation', { appointmentId: apt.id }, { jobId: this.dedupe('send-staff-cancellation', apt.id) });
  }

  // A client tried to cancel past the cancellation window: alert the owner so
  // they can decide whether to cancel the appointment and/or charge a fee.
  async sendLateCancellationRequest(apt: AppointmentWithRelations) {
    await this.queue.add('late-cancel-request', { appointmentId: apt.id }, { removeOnComplete: true });
  }

  // Tell a waitlisted client that a spot opened up (auto-fill on cancellation).
  async notifyWaitlistOpening(waitlistEntryId: string) {
    await this.queue.add('waitlist-opening', { waitlistEntryId }, { jobId: this.dedupe('waitlist-opening', waitlistEntryId) });
  }

  // Post-visit: ask the client to leave a review.
  async sendReviewRequest(apt: AppointmentWithRelations) {
    await this.queue.add('review-request', { appointmentId: apt.id }, { jobId: this.dedupe('review-request', apt.id) });
  }

  // Email the recipient of a freshly-issued gift card.
  async sendGiftCardIssued(giftCardId: string) {
    await this.queue.add('gift-card-issued', { giftCardId }, { jobId: this.dedupe('gift-card-issued', giftCardId), removeOnComplete: true, attempts: 1 });
  }

  // Welcome a newly-registered owner.
  async sendWelcome(userId: string) {
    await this.queue.add('welcome', { userId }, { jobId: this.dedupe('welcome', userId), removeOnComplete: true, attempts: 1 });
  }

  // Email a password-reset link. The token is single-use (signed against the
  // current password hash) and short-lived — see AuthService.
  async sendPasswordReset(userId: string, resetToken: string) {
    await this.queue.add('password-reset', { userId, resetToken }, { jobId: `${this.dedupe('password-reset', userId)}-${Date.now()}`, removeOnComplete: true, attempts: 1 });
  }

  // Security alert: a sign-in from a new device. Includes a reset link so the
  // user can lock the account if it wasn't them.
  async sendSecurityAlert(userId: string, info: { ip?: string; userAgent?: string; resetToken: string }) {
    await this.queue.add(
      'security-alert',
      { userId, ip: info.ip, userAgent: info.userAgent, resetToken: info.resetToken },
      { jobId: `${this.dedupe('security-alert', userId)}-${Date.now()}`, removeOnComplete: true, attempts: 1 },
    );
  }

  // 2FA one-time code, by email or SMS.
  async sendOtp(userId: string, code: string, method: string, phone?: string | null) {
    await this.queue.add(
      'otp',
      { userId, otpCode: code, otpMethod: method, otpPhone: phone ?? undefined },
      { jobId: `otp-${userId}-${Date.now()}`, removeOnComplete: true, attempts: 1 },
    );
  }

  // Email-verification link (gates the client portal).
  async sendVerifyEmail(userId: string, token: string) {
    await this.queue.add('verify-email', { userId, resetToken: token }, { jobId: `${this.dedupe('verify-email', userId)}-${Date.now()}`, removeOnComplete: true, attempts: 1 });
  }

  // Marketing campaign — one job per recipient so the queue can retry individually.
  async sendCampaignMessage(campaignId: string, clientId: string) {
    await this.queue.add(
      'campaign-message',
      { campaignId, clientId },
      { jobId: `campaign-message-${campaignId}-${clientId}`, removeOnComplete: true, attempts: 1 },
    );
  }

  async sendPriorityMessageAlert(messageId: string) {
    await this.queue.add(
      'priority-message-alert',
      { messageId },
      { jobId: `priority-message-alert-${messageId}`, removeOnComplete: true, attempts: 2 },
    );
  }

  async sendAdminBookingAlert(appointmentId: string) {
    const adminEmail = this.configService.get<string>('ADMIN_ALERT_EMAIL');
    if (!adminEmail) {
      console.warn('ADMIN_ALERT_EMAIL not configured — admin alert skipped');
      return;
    }
    const key = this.configService.get<string>('RESEND_API_KEY') ?? '';
    if (!key || key.startsWith('re_placeholder')) {
      console.warn('RESEND_API_KEY not configured — admin alert skipped');
      return;
    }
    await this.queue.add(
      'send-admin-booking-alert',
      { appointmentId },
      { jobId: `${appointmentId}:admin-alert`, removeOnComplete: true },
    );
  }
}
