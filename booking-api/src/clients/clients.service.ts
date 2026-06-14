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
            select: { startsAt: true, totalPriceCents: true, service: { select: { priceCents: true } } },
            orderBy: { startsAt: 'desc' },
          },
          payments: {
            where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
            select: { amountCents: true, refundedCents: true },
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
        totalSpentCents: c.payments.reduce((sum, payment) => sum + payment.amountCents - payment.refundedCents, 0),
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
        payments: {
          where: { status: { in: ['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'] } },
          select: { amountCents: true, refundedCents: true },
        },
      },
    });
    if (!client) throw new NotFoundException('Client not found');

    const totalSpentCents = client.payments.reduce(
      (sum, payment) => sum + payment.amountCents - payment.refundedCents,
      0,
    );

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
          ...(dto.email ? [{ email: { equals: dto.email, mode: 'insensitive' as const } }] : []),
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
    });

    // Public booking may reuse an existing profile, but it must never mutate it.
    // Knowing a client's email or phone is not proof of identity and must not let
    // an unauthenticated caller overwrite their name, phone, or private notes.
    if (existing) return { id: existing.id, businessId: existing.businessId, matched: true as const };

    const created = await this.prisma.client.create({ data: { ...dto, businessId } });
    return { id: created.id, businessId: created.businessId, matched: false as const };
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
    return this.prisma.$transaction(async (tx) => {
      const appointments = await tx.appointment.deleteMany({ where: { clientId: client.id } });
      await tx.client.delete({ where: { id: client.id } });
      return { ok: true, deletedAppointments: appointments.count };
    });
  }

  // Find likely-duplicate clients (same person under a different email/phone).
  // Clients are linked when they share a normalized phone or an identical name;
  // connected groups of 2+ are returned for the owner to review and merge.
  async findDuplicates(businessId: string) {
    const clients = await this.prisma.client.findMany({
      where: { businessId },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });
    const parent = new Map<string, string>();
    const find = (x: string): string => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x)!)!); x = parent.get(x)!; } return x; };
    const union = (a: string, b: string) => { parent.set(find(a), find(b)); };
    for (const c of clients) parent.set(c.id, c.id);

    const byPhone = new Map<string, string>();
    const byName = new Map<string, string>();
    for (const c of clients) {
      const p = normalizePhone(c.phone);
      if (p) { const seen = byPhone.get(p); if (seen) union(seen, c.id); else byPhone.set(p, c.id); }
      const n = c.name.trim().toLowerCase();
      if (n) { const seen = byName.get(n); if (seen) union(seen, c.id); else byName.set(n, c.id); }
    }
    const groups = new Map<string, typeof clients>();
    for (const c of clients) {
      const root = find(c.id);
      const g = groups.get(root) ?? [];
      g.push(c); groups.set(root, g);
    }
    const result: Array<{ clients: Array<typeof clients[number] & { appointments: number }> }> = [];
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      const counts = await this.prisma.appointment.groupBy({
        by: ['clientId'], where: { clientId: { in: g.map((c) => c.id) } }, _count: { _all: true },
      });
      const cmap = new Map(counts.map((c) => [c.clientId, c._count._all]));
      result.push({ clients: g.map((c) => ({ ...c, appointments: cmap.get(c.id) ?? 0 })) });
    }
    return result;
  }

  // Merge duplicates into the primary: all bookings/messages/payments/packages/
  // follow-ups move over, the duplicates are deleted, and the owner-chosen
  // name/email/phone are applied to the survivor.
  async merge(businessId: string, primaryId: string, dupeIds: string[], canonical: { name?: string; email?: string; phone?: string | null }) {
    const ids = [...new Set([primaryId, ...dupeIds])];
    const found = await this.prisma.client.findMany({ where: { id: { in: ids }, businessId }, select: { id: true } });
    if (found.length !== ids.length) throw new NotFoundException('One or more clients not found in this business');
    const dupes = ids.filter((id) => id !== primaryId);
    if (!dupes.length) return { ok: true, merged: 0 };

    return this.prisma.$transaction(async (tx) => {
      const where = { clientId: { in: dupes } };
      const to = { clientId: primaryId };
      await tx.appointment.updateMany({ where, data: to });
      await tx.message.updateMany({ where, data: to });
      await tx.payment.updateMany({ where, data: to });
      await tx.clientPackage.updateMany({ where, data: to });
      await tx.serviceDue.updateMany({ where, data: to });
      await tx.client.deleteMany({ where: { id: { in: dupes }, businessId } });
      await tx.client.update({
        where: { id: primaryId },
        data: {
          ...(canonical.name ? { name: canonical.name.trim() } : {}),
          ...(canonical.email ? { email: canonical.email.trim().toLowerCase() } : {}),
          ...(canonical.phone !== undefined ? { phone: canonical.phone ? normalizePhone(canonical.phone) : null } : {}),
        },
      });
      return { ok: true, merged: dupes.length };
    });
  }

  exportAll(businessId: string) {
    return this.prisma.client.findMany({
      where: { businessId },
      select: { name: true, email: true, phone: true, tags: true, notes: true, birthday: true, createdAt: true },
      orderBy: { name: 'asc' },
    });
  }

  async bulkImport(businessId: string, rows: Array<{ name: string; email?: string; phone?: string; tags?: string; notes?: string }>) {
    let created = 0; let updated = 0;
    for (const row of rows) {
      if (!row.name?.trim()) continue;
      const email = row.email?.trim().toLowerCase() || undefined;
      const phone = row.phone?.trim() ? normalizePhone(row.phone.trim()) : undefined;
      const tags = row.tags ? row.tags.split(';').map(t => t.trim()).filter(Boolean) : [];
      const existing = email
        ? await this.prisma.client.findFirst({ where: { businessId, email } })
        : null;
      if (existing) {
        await this.prisma.client.update({ where: { id: existing.id }, data: { phone: phone ?? existing.phone, tags: tags.length ? tags : existing.tags, notes: row.notes?.trim() ?? existing.notes } });
        updated++;
      } else {
        const created_ok = await this.prisma.client.create({ data: { businessId, name: row.name.trim(), email, phone, tags, notes: row.notes?.trim() } }).then(() => true).catch(() => false);
        if (created_ok) created++; else updated++;
      }
    }
    return { created, updated, total: rows.length };
  }
}
