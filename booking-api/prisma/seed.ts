import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Minimal LOCAL seed: one owner test login + its EMPTY business.
 *
 * Intentionally empty (no staff, services, clients, or appointments) so the
 * owner test account mirrors exactly what a real tester gets after signing up:
 * a blank business they set up themselves. The platform admin and all demo
 * staff/clients/appointments have been removed.
 */
async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error(
      'Refusing to run demo seed in production (NODE_ENV=production). ' +
      'Demo accounts with default passwords must never exist on prod.',
    );
    process.exit(1);
  }

  console.log('🌱 Seeding database...');

  // ── Business (empty) ─────────────────────────────────────────────────────────
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
      bookingPageSettings: { primaryColor: '#E9A23C', allowOnlineBooking: true },
    },
  });
  console.log('  ✔ business:', business.slug);

  // ── Owner test login (the only seeded account) ───────────────────────────────
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

  console.log('\n✅ Seed complete! (empty business — add services/staff in-app)');
  console.log('\nLogin credentials:');
  console.log('  Owner — owner@demo-salon.com / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
