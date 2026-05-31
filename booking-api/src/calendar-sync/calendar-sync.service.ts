import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarSyncService {
  constructor(private prisma: PrismaService) {}

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
    // Placeholder for Google/Outlook calendar sync logic
    console.log(`[CalendarSync stub] Syncing appointment: ${appointmentId}`);
    return { success: true };
  }
}
