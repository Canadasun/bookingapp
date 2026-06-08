import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleCalendarService } from './google-calendar.service';

@Injectable()
export class CalendarSyncService {
  private readonly logger = new Logger(CalendarSyncService.name);

  constructor(
    private prisma: PrismaService,
    private google: GoogleCalendarService,
  ) {}

  async syncAppointment(
    appointmentId: string,
    user: { role: string; businessId: string | null },
  ) {
    const apt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      select: { businessId: true },
    });
    if (!apt) throw new NotFoundException('Appointment not found');
    if (user.role !== 'ADMIN' && apt.businessId !== user.businessId) {
      throw new ForbiddenException('You do not have access to this appointment');
    }
    // Try Google Calendar sync with up to 3 attempts (exponential backoff).
    // Falls back gracefully — the iCal attachment in confirmation emails is
    // always the baseline calendar redundancy when Google is not connected or fails.
    const synced = await this.syncWithRetry(appointmentId);
    return { success: true, googleSynced: synced };
  }

  // Retry wrapper for Google Calendar sync — handles transient API failures.
  // Returns true if sync succeeded, false if Google is not connected or all attempts failed.
  async syncWithRetry(appointmentId: string, maxAttempts = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.google.syncAppointment(appointmentId);
        return true;
      } catch (e) {
        if (attempt === maxAttempts) {
          this.logger.warn(`Calendar sync failed after ${maxAttempts} attempts for ${appointmentId}: ${e}`);
          return false;
        }
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    return false;
  }

  async removeWithRetry(appointmentId: string, maxAttempts = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.google.removeAppointment(appointmentId);
        return true;
      } catch (e) {
        if (attempt === maxAttempts) {
          this.logger.warn(`Calendar remove failed after ${maxAttempts} attempts for ${appointmentId}: ${e}`);
          return false;
        }
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
    return false;
  }
}
