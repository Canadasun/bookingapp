import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { signAppointmentToken } from '../common/util/appointment-token';
import { normalizePhone } from '../common/util/phone';

@Injectable()
export class ClientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, search?: string, page = 1, limit = 25) {
    const skip = (page - 1) * limit;
    const where = {
      businessId,
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: search } },
              { name: { contains: search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [clients, total] = await Promise.all([
      this.prisma.client.findMany({
        where,
        include: {
          _count: { select: { appointments: true } },
          appointments: {
            where: { status: 'COMPLETED' },
            include: { service: { select: { priceCents: true } } },
            orderBy: { startsAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.client.count({ where }),
    ]);

    return {
      data: clients.map((c) => ({
        id: c.id,
        businessId: c.businessId,
        name: c.name,
        email: c.email,
        phone: c.phone,
        notes: c.notes,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        totalVisits: c._count.appointments,
        lastVisit: c.appointments[0]?.startsAt ?? null,
        totalSpentCents: c.appointments.reduce((sum, a) => sum + a.service.priceCents, 0),
      })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string, businessId?: string) {
    const client = await this.prisma.client.findFirst({
      where: { 
        id,
        ...(businessId ? { businessId } : {})
      },
      include: {
        appointments: {
          include: { service: true, staff: { include: { user: true } } },
          orderBy: { startsAt: 'desc' },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    const totalSpentCents = client.appointments
      .filter((a) => a.status === 'COMPLETED')
      .reduce((sum, a) => sum + a.service.priceCents, 0);

    return { ...client, totalSpentCents };
  }

  getAppointmentHistory(clientId: string, businessId?: string) {
    return this.prisma.appointment.findMany({
      where: { 
        clientId,
        ...(businessId ? { businessId } : {})
      },
      include: { service: true, staff: { include: { user: true } } },
      orderBy: { startsAt: 'desc' },
    });
  }

  async lookupByEmailOrPhone(businessId: string, email?: string, phone?: string) {
    if (!email && !phone) return null;
    const phoneTerms = phone
      ? [...new Set([phone.trim(), normalizePhone(phone)].filter(Boolean) as string[])]
      : [];
    const client = await this.prisma.client.findFirst({
      where: {
        businessId,
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...phoneTerms.map((p) => ({ phone: p })),
        ],
      },
      include: {
        appointments: {
          include: { service: true, staff: { include: { user: true } }, business: true },
          orderBy: { startsAt: 'desc' },
        },
      },
    });
    if (!client) return null;
    // Attach a manage token to each booking so the guest-lookup page can build
    // valid manage links (the lookup itself proves ownership via email/phone).
    return {
      ...client,
      appointments: client.appointments.map((a) => ({ ...a, manageToken: signAppointmentToken(a.id) })),
    };
  }

  // Used by the public booking wizard + walk-in/owner flows. Dedups on email OR
  // phone within the business so the same person isn't duplicated when they book
  // again with a slightly different detail. Returns the client with a `matched`
  // flag so the UI can tell the user it synced to an existing profile.
  async findOrCreate(businessId: string, dto: CreateClientDto) {
    const existing = await this.prisma.client.findFirst({
      where: {
        businessId,
        OR: [
          { email: { equals: dto.email, mode: 'insensitive' as const } },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    if (existing) {
      // Merge in the freshest details. Don't overwrite the email when we matched
      // on phone (avoids colliding with the businessId_email unique constraint);
      // fill phone in if it was missing before.
      const updated = await this.prisma.client.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          ...(dto.phone && dto.phone !== existing.phone ? { phone: dto.phone } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        },
      });
      return { ...updated, matched: true as const };
    }

    const created = await this.prisma.client.create({ data: { ...dto, businessId } });
    return { ...created, matched: false as const };
  }

  create(businessId: string, dto: CreateClientDto) {
    return this.prisma.client.create({ data: { ...dto, businessId } });
  }

  async update(id: string, dto: UpdateClientDto, businessId?: string) {
    const client = await this.findOne(id, businessId);
    return this.prisma.client.update({ where: { id: client.id }, data: dto });
  }

  async remove(id: string, businessId?: string) {
    const client = await this.findOne(id, businessId);
    return this.prisma.client.delete({ where: { id: client.id } });
  }
}
