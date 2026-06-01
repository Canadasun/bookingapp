import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';

/**
 * Idempotent PRODUCTION seed. Safe to re-run (upserts; never duplicates, never
 * resets an existing user's password). Creates a bookable starter business.
 *
 * Passwords come ONLY from environment variables — none are hardcoded here or
 * generated-and-stored:
 *   OWNER_PASSWORD  (required to create the demo owner login)
 *   ADMIN_PASSWORD  (required to create the platform admin; the admin is created
 *                    with mustResetPassword=true so this is just a one-time
 *                    bootstrap value the admin must change on first login)
 * Optional overrides: SEED_BUSINESS_SLUG, SEED_BUSINESS_NAME, OWNER_EMAIL,
 *   ADMIN_EMAIL, STAFF_EMAIL.
 */
const prisma = new PrismaClient();

async function main() {
  const slug = process.env.SEED_BUSINESS_SLUG || 'demo-salon';
  const name = process.env.SEED_BUSINESS_NAME || 'Demo Salon';
  const ownerEmail = process.env.OWNER_EMAIL || 'owner@demo-salon.com';
  const ownerPassword = process.env.OWNER_PASSWORD;
  const adminEmail = process.env.ADMIN_EMAIL || 'pmayeni1@icloud.com';
  const adminPassword = process.env.ADMIN_PASSWORD;
  const staffEmail = process.env.STAFF_EMAIL || 'stylist@demo-salon.com';

  // ── Business (idempotent by slug) ──────────────────────────────────────────
  const business = await prisma.business.upsert({
    where: { slug },
    update: { name },
    create: {
      name, slug,
      email: `hello@${slug}.com`,
      phone: '+15550001234',
      timezone: 'America/New_York',
      address: '123 Main St',
      bookingPageSettings: { primaryColor: '#6366f1', allowOnlineBooking: true },
    },
  });
  console.log('business:', business.slug, '->', business.id);

  // ── Owner (create only if missing; password strictly from env) ─────────────
  if (ownerPassword) {
    const existing = await prisma.user.findUnique({ where: { email: ownerEmail } });
    if (!existing) {
      await prisma.user.create({
        data: { name: 'Demo Owner', email: ownerEmail, passwordHash: await bcrypt.hash(ownerPassword, 10), role: 'OWNER', businessId: business.id },
      });
      console.log('owner CREATED:', ownerEmail);
    } else console.log('owner exists (unchanged):', ownerEmail);
  } else console.log('OWNER_PASSWORD not set — owner skipped');

  // ── Admin with forced reset (password strictly from env; never generated) ──
  if (adminPassword) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      await prisma.user.create({
        data: { name: 'Platform Admin', email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 10), role: 'ADMIN', mustResetPassword: true },
      });
      console.log('admin CREATED (must reset password on first login):', adminEmail);
    } else console.log('admin exists (unchanged):', adminEmail);
  } else console.log('ADMIN_PASSWORD not set — admin skipped (set it to bootstrap the admin with forced reset)');

  // ── Services (idempotent by stable id) ─────────────────────────────────────
  const svc = (id: string, sname: string, dur: number, price: number, extra = {}) =>
    prisma.service.upsert({ where: { id }, update: {}, create: { id, businessId: business.id, name: sname, durationMinutes: dur, priceCents: price, ...extra } });
  const haircut = await svc('prod-svc-haircut', 'Haircut', 60, 4500, { bufferAfterMin: 10 });
  const color = await svc('prod-svc-color', 'Color & Highlights', 120, 12000, { bufferBeforeMin: 5, bufferAfterMin: 15 });

  // ── One staff so the calendar is bookable. Staff login is NOT provisioned
  //    (random throwaway hash + forced reset); use the owner's invite flow for
  //    real staff logins. ───────────────────────────────────────────────────
  let staffUser = await prisma.user.findUnique({ where: { email: staffEmail } });
  if (!staffUser) {
    staffUser = await prisma.user.create({
      data: { name: 'Demo Stylist', email: staffEmail, passwordHash: await bcrypt.hash(randomBytes(24).toString('hex'), 10), role: 'STAFF', businessId: business.id, mustResetPassword: true },
    });
  }
  const staff = await prisma.staff.upsert({ where: { userId: staffUser.id }, update: {}, create: { userId: staffUser.id, businessId: business.id, bio: 'Demo stylist.' } });

  await prisma.staffService.deleteMany({ where: { staffId: staff.id } });
  await prisma.staffService.createMany({ data: [{ staffId: staff.id, serviceId: haircut.id }, { staffId: staff.id, serviceId: color.id }] });

  await prisma.availabilityRule.deleteMany({ where: { staffId: staff.id } });
  await prisma.availabilityRule.createMany({ data: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ staffId: staff.id, dayOfWeek: d, startTime: '09:00', endTime: '17:00' })) });

  console.log('services + staff + availability ensured');
  console.log('\nPROD_BUSINESS_ID=' + business.id);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
