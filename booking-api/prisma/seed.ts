import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { addDays, addMinutes, setHours, setMinutes, startOfDay } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
  // Safety: this seed creates demo accounts with well-known passwords
  // (owner/bob/sara @demo-salon.com / password123). Never let it run against a
  // production database.
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'Refusing to run demo seed in production (NODE_ENV=production). ' +
      'Demo accounts with default passwords must never exist on prod.',
    );
    process.exit(1);
  }

  console.log('🌱 Seeding database...');

  // ── Business ────────────────────────────────────────────────────────────────
  const business = await prisma.business.upsert({
    where: { slug: 'demo-salon' },
    update: {},
    create: {
      name: 'Demo Salon',
      slug: 'demo-salon',
      email: 'hello@demo-salon.com',
      phone: '+15550001234',
      timezone: 'America/New_York',
      address: '123 Main St, New York, NY 10001',
      bookingPageSettings: { primaryColor: '#6366f1', allowOnlineBooking: true },
    },
  });
  console.log('  ✔ business:', business.slug);

  // ── Owner ────────────────────────────────────────────────────────────────────
  const ownerHash = await bcrypt.hash('password123', 10);
  const owner = await prisma.user.upsert({
    where: { email: 'owner@demo-salon.com' },
    update: {},
    create: {
      name: 'Alice Owner',
      email: 'owner@demo-salon.com',
      passwordHash: ownerHash,
      role: 'OWNER',
      businessId: business.id,
    },
  });
  console.log('  ✔ owner:', owner.email);

  // ── Staff users ──────────────────────────────────────────────────────────────
  const staffHash = await bcrypt.hash('password123', 10);

  const bobUser = await prisma.user.upsert({
    where: { email: 'bob@demo-salon.com' },
    update: {},
    create: {
      name: 'Bob Barber',
      email: 'bob@demo-salon.com',
      passwordHash: staffHash,
      role: 'STAFF',
      businessId: business.id,
    },
  });

  const saraUser = await prisma.user.upsert({
    where: { email: 'sara@demo-salon.com' },
    update: {},
    create: {
      name: 'Sara Stylist',
      email: 'sara@demo-salon.com',
      passwordHash: staffHash,
      role: 'STAFF',
      businessId: business.id,
    },
  });

  // ── Staff records ─────────────────────────────────────────────────────────────
  const bob = await prisma.staff.upsert({
    where: { userId: bobUser.id },
    update: {},
    create: { userId: bobUser.id, businessId: business.id, bio: 'Expert barber with 10+ years experience.' },
  });

  const sara = await prisma.staff.upsert({
    where: { userId: saraUser.id },
    update: {},
    create: { userId: saraUser.id, businessId: business.id, bio: 'Specialist in color and highlights.' },
  });
  console.log('  ✔ staff: Bob, Sara');

  // ── Services ──────────────────────────────────────────────────────────────────
  const haircut = await prisma.service.upsert({
    where: { id: 'seed-svc-haircut' },
    update: {},
    create: {
      id: 'seed-svc-haircut',
      businessId: business.id,
      name: 'Haircut',
      durationMinutes: 60,
      priceCents: 4500,
      bufferAfterMin: 10,
    },
  });

  const colorService = await prisma.service.upsert({
    where: { id: 'seed-svc-color' },
    update: {},
    create: {
      id: 'seed-svc-color',
      businessId: business.id,
      name: 'Color & Highlights',
      durationMinutes: 120,
      priceCents: 12000,
      bufferBeforeMin: 5,
      bufferAfterMin: 15,
    },
  });

  const shave = await prisma.service.upsert({
    where: { id: 'seed-svc-shave' },
    update: {},
    create: {
      id: 'seed-svc-shave',
      businessId: business.id,
      name: 'Beard Trim & Shave',
      durationMinutes: 30,
      priceCents: 2500,
      bufferAfterMin: 5,
    },
  });
  console.log('  ✔ services: Haircut, Color, Shave');

  // ── StaffServices ─────────────────────────────────────────────────────────────
  await prisma.staffService.deleteMany({ where: { staffId: { in: [bob.id, sara.id] } } });
  await prisma.staffService.createMany({
    data: [
      { staffId: bob.id, serviceId: haircut.id },
      { staffId: bob.id, serviceId: shave.id },
      { staffId: sara.id, serviceId: haircut.id },
      { staffId: sara.id, serviceId: colorService.id },
    ],
  });

  // ── Availability rules (Mon–Fri 9–17) ─────────────────────────────────────────
  await prisma.availabilityRule.deleteMany({ where: { staffId: { in: [bob.id, sara.id] } } });
  const weekdays = [1, 2, 3, 4, 5]; // Mon–Fri
  await prisma.availabilityRule.createMany({
    data: [
      ...weekdays.map((d) => ({ staffId: bob.id, dayOfWeek: d, startTime: '09:00', endTime: '17:00' })),
      ...weekdays.map((d) => ({ staffId: sara.id, dayOfWeek: d, startTime: '10:00', endTime: '18:00' })),
    ],
  });
  console.log('  ✔ availability rules set');

  // ── Demo client ───────────────────────────────────────────────────────────────
  const client = await prisma.client.upsert({
    where: { businessId_email: { businessId: business.id, email: 'jane@example.com' } },
    update: {},
    create: {
      businessId: business.id,
      name: 'Jane Demo',
      email: 'jane@example.com',
      phone: '+15550009999',
    },
  });
  console.log('  ✔ client: Jane Demo');

  // ── Sample appointments ───────────────────────────────────────────────────────
  const today = startOfDay(new Date());
  const apptData = [
    { startsAt: setMinutes(setHours(addDays(today, 1), 10), 0), service: haircut, staff: bob, status: 'CONFIRMED' },
    { startsAt: setMinutes(setHours(addDays(today, 1), 14), 0), service: shave, staff: bob, status: 'PENDING' },
    { startsAt: setMinutes(setHours(addDays(today, 2), 11), 0), service: colorService, staff: sara, status: 'CONFIRMED' },
    { startsAt: setMinutes(setHours(addDays(today, 3), 9), 0), service: haircut, staff: sara, status: 'PENDING' },
    { startsAt: setMinutes(setHours(addDays(today, -1), 10), 0), service: haircut, staff: bob, status: 'COMPLETED' },
  ] as const;

  for (const a of apptData) {
    await prisma.appointment.create({
      data: {
        businessId: business.id,
        staffId: a.staff.id,
        serviceId: a.service.id,
        clientId: client.id,
        startsAt: a.startsAt,
        endsAt: addMinutes(a.startsAt, a.service.durationMinutes),
        status: a.status,
      },
    });
  }
  console.log('  ✔ 5 sample appointments created');

  console.log('\n✅ Seed complete!');
  console.log('\nLogin credentials:');
  console.log('  Owner  — owner@demo-salon.com / password123');
  console.log('  Staff  — bob@demo-salon.com   / password123');
  console.log('  Staff  — sara@demo-salon.com  / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
