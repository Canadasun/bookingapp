import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { format } from 'date-fns';

export const NOTIFICATION_QUEUE = 'notifications';

export interface AppointmentWithRelations {
  id: string;
  startsAt: Date;
  endsAt: Date;
  client: { name: string; email: string; phone?: string | null };
  service: { name: string };
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectQueue(NOTIFICATION_QUEUE) private queue: Queue,
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async scheduleReminders(apt: AppointmentWithRelations) {
    const now = Date.now();
    const delay24h = apt.startsAt.getTime() - now - 24 * 60 * 60 * 1000;
    const delay2h = apt.startsAt.getTime() - now - 2 * 60 * 60 * 1000;

    if (delay24h > 0) {
      await this.queue.add(
        'reminder-24h',
        { appointmentId: apt.id },
        { delay: delay24h, jobId: `reminder-24h-${apt.id}`, removeOnComplete: true },
      );
    }
    if (delay2h > 0) {
      await this.queue.add(
        'reminder-2h',
        { appointmentId: apt.id },
        { delay: delay2h, jobId: `reminder-2h-${apt.id}`, removeOnComplete: true },
      );
    }

    await this.sendConfirmation(apt);
  }

  async cancelReminders(appointmentId: string) {
    const jobs = await Promise.allSettled([
      this.queue.remove(`reminder-24h-${appointmentId}`),
      this.queue.remove(`reminder-2h-${appointmentId}`),
    ]);
    return jobs;
  }

  async sendConfirmation(apt: AppointmentWithRelations) {
    await this.queue.add('send-confirmation', { appointmentId: apt.id });
  }

  async sendPendingNotification(apt: AppointmentWithRelations) {
    await this.queue.add('send-pending', { appointmentId: apt.id });
  }

  async sendCancellation(apt: AppointmentWithRelations) {
    await this.queue.add('send-cancellation', { appointmentId: apt.id });
  }

  async sendReschedule(apt: AppointmentWithRelations) {
    await this.queue.add('send-reschedule', { appointmentId: apt.id });
  }

  async sendStaffCancellation(apt: AppointmentWithRelations) {
    await this.queue.add('send-staff-cancellation', { appointmentId: apt.id });
  }

  // Tell a waitlisted client that a spot opened up (auto-fill on cancellation).
  async notifyWaitlistOpening(waitlistEntryId: string) {
    await this.queue.add('waitlist-opening', { waitlistEntryId });
  }

  // Post-visit: ask the client to leave a review.
  async sendReviewRequest(apt: AppointmentWithRelations) {
    await this.queue.add('review-request', { appointmentId: apt.id });
  }

  // Email the recipient of a freshly-issued gift card.
  async sendGiftCardIssued(giftCardId: string) {
    await this.queue.add('gift-card-issued', { giftCardId }, { removeOnComplete: true, attempts: 3 });
  }

  // Marketing campaign — one job per recipient so the queue can retry individually.
  async sendCampaignMessage(campaignId: string, clientId: string) {
    await this.queue.add(
      'campaign-message',
      { campaignId, clientId },
      { removeOnComplete: true, attempts: 3, backoff: { type: 'fixed', delay: 5000 } },
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
