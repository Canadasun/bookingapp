// One-off setup for VIPLUXE Beauty (real data). Idempotent-ish: fails loudly if exists.
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  const out = {};
  const business = await prisma.business.create({
    data: {
      name: 'VIPLUXE Beauty',
      slug: 'vipluxe-beauty',
      email: 'emeraldayeni@gmail.com',
      phone: '3689936012',
      timezone: 'America/Edmonton', // Calgary
      address: 'Downtown Calgary',
      plan: 'PRO',
      bookingPageSettings: { primaryColor: '#7C3AED', allowOnlineBooking: true },
    },
  });
  out.businessId = business.id;

  const passwordHash = await bcrypt.hash('Wuraola92', 10);
  const owner = await prisma.user.create({
    data: {
      name: 'Emerald Ayeni',
      email: 'emeraldayeni@gmail.com',
      passwordHash,
      phone: '3689936012',
      role: 'OWNER',
      businessId: business.id,
    },
  });
  out.ownerId = owner.id;

  const staff = await prisma.staff.create({
    data: { userId: owner.id, businessId: business.id, bio: 'Owner & lead artist' },
  });
  out.staffId = staff.id;

  // Generic, non-niche services the user can fully edit later.
  const services = await Promise.all([
    prisma.service.create({ data: { businessId: business.id, name: 'Classic Lash Set', durationMinutes: 90, priceCents: 12000, bufferAfterMin: 15, sortOrder: 0, description: 'Full classic lash extensions.' } }),
    prisma.service.create({ data: { businessId: business.id, name: 'Teeth Whitening', durationMinutes: 60, priceCents: 15000, bufferAfterMin: 15, sortOrder: 1, description: 'Professional whitening session.' } }),
    prisma.service.create({ data: { businessId: business.id, name: 'Gel Manicure', durationMinutes: 60, priceCents: 6000, bufferAfterMin: 15, sortOrder: 2, description: 'Gel polish manicure with prep.' } }),
  ]);
  out.serviceIds = services.map((s) => s.id);

  // Link all services to the owner-as-staff.
  await prisma.staffService.createMany({
    data: services.map((s) => ({ staffId: staff.id, serviceId: s.id })),
  });

  // Availability: every day 09:00–19:00 (business timezone) so any date works.
  await prisma.availabilityRule.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      staffId: staff.id, dayOfWeek: d, startTime: '09:00', endTime: '19:00',
    })),
  });

  console.log('SETUP_RESULT::' + JSON.stringify(out) + '::END');
}

main().catch((e) => { console.error('SETUP_ERR::' + e.message); process.exit(1); }).finally(() => prisma.$disconnect());
