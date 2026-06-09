import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { signAppointmentToken } from '../common/util/appointment-token';

@Injectable()
export class ClientPortalService {
  constructor(private prisma: PrismaService) {}

  async getAppointments(email: string, displayName: string) {
    const clients = await this.prisma.client.findMany({
      where: { email },
      include: {
        business: { select: { id: true, name: true, phone: true, address: true, verificationStatus: true } },
        appointments: {
          include: {
            service: true,
            staff: { include: { user: { select: { name: true } } } },
          },
          orderBy: { startsAt: 'desc' },
        },
      },
    });

    // Use the user's own account name (not the business's internal label for them).
    // Never expose c.name, c.notes, or c.tags to the client.
    return clients.flatMap((c) =>
      c.appointments.map((a) => ({
        ...a,
        business: c.business,
        client: { id: c.id, name: displayName, email: c.email, phone: c.phone },
        manageToken: signAppointmentToken(a.id),
      }))
    ).sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  }

  async getMessages(email: string) {
    const clients = await this.prisma.client.findMany({
      where: { email },
      include: {
        business: { select: { id: true, name: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });

    return clients
      .filter((c) => c.messages.length > 0)
      .map((c) => ({
        businessId: c.business.id,
        businessName: c.business.name,
        clientId: c.id,
        messages: c.messages,
      }));
  }

  async getOffers(email: string) {
    const clients = await this.prisma.client.findMany({
      where: { email },
      select: { businessId: true },
    });
    const bizIds = [...new Set(clients.map((c) => c.businessId))];

    return this.prisma.offer.findMany({
      where: {
        businessId: { in: bizIds },
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { business: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
