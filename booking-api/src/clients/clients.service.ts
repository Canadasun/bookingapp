import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

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
    const client = await this.prisma.client.findFirst({
      where: {
        businessId,
        OR: [
          ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
          ...(phone ? [{ phone }] : []),
        ],
      },
      include: {
        appointments: {
          include: { service: true, staff: { include: { user: true } }, business: true },
          orderBy: { startsAt: 'desc' },
        },
      },
    });
    return client;
  }

  // Used by the public booking wizard — returns existing client if email already registered
  findOrCreate(businessId: string, dto: CreateClientDto) {
    return this.prisma.client.upsert({
      where: { businessId_email: { businessId, email: dto.email } },
      create: { ...dto, businessId },
      update: {
        name: dto.name,
        ...(dto.phone !== undefined ? { phone: dto.phone } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
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
