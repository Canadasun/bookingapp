import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SearchHit = { type: string; id: string; label: string; sublabel?: string; href: string };
export type SearchGroup = { type: string; label: string; hits: SearchHit[] };

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  // Global dashboard search across a single business's data. Each entity is
  // capped so the palette stays fast; results carry their own deep link.
  async global(businessId: string, q: string): Promise<{ query: string; groups: SearchGroup[] }> {
    const ci = { contains: q, mode: 'insensitive' as const };
    const take = 5;
    const asNumber = /^\d+$/.test(q) ? parseInt(q, 10) : null;
    // Typo tolerance: pg_trgm `%` similarity (backed by the GIN indexes) plus an
    // ILIKE substring scan so exact substrings always match too. Ranked by
    // trigram similarity. $queryRaw parameterizes every ${} as a bind value.
    const like = `%${q}%`;

    const [clients, staff, services, invoices, appointments, locations] = await Promise.all([
      this.prisma.$queryRaw<{ id: string; name: string; email: string | null }[]>`
        SELECT "id", "name", "email" FROM "Client"
        WHERE "businessId" = ${businessId}
          AND ("name" % ${q} OR "name" ILIKE ${like} OR COALESCE("email", '') ILIKE ${like} OR COALESCE("phone", '') ILIKE ${like})
        ORDER BY similarity("name", ${q}) DESC, "updatedAt" DESC
        LIMIT ${take}`,
      this.prisma.$queryRaw<{ id: string; name: string }[]>`
        SELECT s."id", u."name" FROM "Staff" s JOIN "User" u ON u."id" = s."userId"
        WHERE s."businessId" = ${businessId}
          AND (u."name" % ${q} OR u."name" ILIKE ${like})
        ORDER BY similarity(u."name", ${q}) DESC
        LIMIT ${take}`,
      this.prisma.$queryRaw<{ id: string; name: string; priceCents: number }[]>`
        SELECT "id", "name", "priceCents" FROM "Service"
        WHERE "businessId" = ${businessId}
          AND ("name" % ${q} OR "name" ILIKE ${like})
        ORDER BY similarity("name", ${q}) DESC, "sortOrder" ASC
        LIMIT ${take}`,
      this.prisma.invoice.findMany({
        where: { businessId, OR: [...(asNumber !== null ? [{ number: asNumber }] : []), { client: { name: ci } }] },
        select: { id: true, number: true, status: true, client: { select: { name: true } } },
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.appointment.findMany({
        where: { businessId, OR: [{ client: { name: ci } }, { service: { name: ci } }] },
        select: { id: true, startsAt: true, client: { select: { name: true } }, service: { select: { name: true } } },
        take,
        orderBy: { startsAt: 'desc' },
      }),
      this.prisma.$queryRaw<{ id: string; name: string; address: string | null }[]>`
        SELECT "id", "name", "address" FROM "Location"
        WHERE "businessId" = ${businessId}
          AND ("name" % ${q} OR "name" ILIKE ${like} OR COALESCE("address", '') ILIKE ${like})
        ORDER BY similarity("name", ${q}) DESC
        LIMIT ${take}`,
    ]);

    const groups: SearchGroup[] = [];
    const push = (type: string, label: string, hits: SearchHit[]) => {
      if (hits.length) groups.push({ type, label, hits });
    };
    const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    push('client', 'Clients', clients.map((c) => ({
      type: 'client',
      id: c.id,
      label: c.name,
      sublabel: c.email ?? undefined,
      href: `/dashboard/clients?search=${encodeURIComponent(c.name)}`,
    })));
    push('staff', 'Staff', staff.map((s) => ({
      type: 'staff',
      id: s.id,
      label: s.name ?? 'Staff member',
      href: `/dashboard/staff/${s.id}`,
    })));
    push('service', 'Services', services.map((s) => ({
      type: 'service',
      id: s.id,
      label: s.name,
      sublabel: money(s.priceCents),
      href: `/dashboard/services`,
    })));
    push('invoice', 'Invoices', invoices.map((i) => ({
      type: 'invoice',
      id: i.id,
      label: `Invoice #${i.number}`,
      sublabel: i.client?.name ?? i.status,
      href: `/dashboard/invoices/${i.id}`,
    })));
    push('appointment', 'Appointments', appointments.map((a) => ({
      type: 'appointment',
      id: a.id,
      label: a.client?.name ?? 'Appointment',
      sublabel: [a.service?.name, a.startsAt.toLocaleDateString('en-CA', { dateStyle: 'medium' })].filter(Boolean).join(' · '),
      href: `/dashboard/appointments`,
    })));
    push('location', 'Locations', locations.map((l) => ({
      type: 'location',
      id: l.id,
      label: l.name,
      sublabel: l.address ?? undefined,
      href: `/dashboard/locations`,
    })));

    return { query: q, groups };
  }
}
