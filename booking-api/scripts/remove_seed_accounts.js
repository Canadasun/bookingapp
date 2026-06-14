/**
 * One-off production cleanup: removes all seed/demo accounts and their
 * associated business if no real paying users exist under it.
 *
 * Usage:
 *   DATABASE_URL=<prod-url> node scripts/remove_seed_accounts.js [--dry-run]
 *
 * Pass --dry-run to preview what would be deleted without touching data.
 */
try { require('dotenv').config(); } catch { /* dotenv optional */ }

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

const SEED_EMAILS = [
  'owner@demo-salon.com',
  'stylist@demo-salon.com',
  'pmayeni1@icloud.com',  // seed_admin.js admin account
];
const SEED_SLUG = 'demo-salon';

async function main() {
  console.log(DRY_RUN ? '*** DRY RUN — no data will be deleted ***\n' : '*** LIVE RUN — deleting seed data ***\n');

  // ── 1. Seed user accounts ──────────────────────────────────────────────────
  const seedUsers = await prisma.user.findMany({
    where: { email: { in: SEED_EMAILS } },
    select: { id: true, email: true, role: true, businessId: true, createdAt: true },
  });

  if (seedUsers.length === 0) {
    console.log('No seed user accounts found in the database — nothing to remove.');
  } else {
    console.log('Seed user accounts found:');
    seedUsers.forEach(u => console.log(`  ${u.email}  role=${u.role}  businessId=${u.businessId}  created=${u.createdAt.toISOString()}`));
    if (!DRY_RUN) {
      await prisma.user.deleteMany({ where: { id: { in: seedUsers.map(u => u.id) } } });
      console.log(`  => Deleted ${seedUsers.length} user(s)\n`);
    } else {
      console.log(`  => Would delete ${seedUsers.length} user(s)\n`);
    }
  }

  // ── 2. Demo business ───────────────────────────────────────────────────────
  const demoBiz = await prisma.business.findUnique({
    where: { slug: SEED_SLUG },
    select: { id: true, name: true, slug: true, plan: true, createdAt: true },
  });

  if (!demoBiz) {
    console.log('No demo-salon business found — nothing to remove.');
  } else {
    console.log(`Demo business found: ${demoBiz.name} (${demoBiz.slug})  plan=${demoBiz.plan}  created=${demoBiz.createdAt.toISOString()}`);

    // Safety: only delete if no real paying users remain under this business
    const realUsers = await prisma.user.findMany({
      where: { businessId: demoBiz.id, email: { notIn: SEED_EMAILS } },
      select: { email: true, role: true },
    });
    if (realUsers.length > 0) {
      console.error(`\n⚠️  ABORT: demo-salon business has ${realUsers.length} non-seed user(s). Remove them manually first:`);
      realUsers.forEach(u => console.error(`  ${u.email}  role=${u.role}`));
      process.exit(1);
    }

    if (!DRY_RUN) {
      // Cascade deletions in dependency order
      await prisma.staffService.deleteMany({ where: { staff: { businessId: demoBiz.id } } });
      await prisma.availabilityRule.deleteMany({ where: { staff: { businessId: demoBiz.id } } });
      await prisma.staff.deleteMany({ where: { businessId: demoBiz.id } });
      await prisma.service.deleteMany({ where: { businessId: demoBiz.id } });
      await prisma.business.delete({ where: { id: demoBiz.id } });
      console.log('  => Deleted demo-salon business and its services/staff\n');
    } else {
      console.log('  => Would delete demo-salon business and its services/staff\n');
    }
  }

  // ── 3. Sample transactions from seed_admin.js ─────────────────────────────
  const sampleTxCount = await prisma.transaction.count({
    where: {
      type: { in: ['SUBSCRIPTION', 'COMMISSION'] },
      provider: 'STRIPE',
      // seed_admin.js only inserts these two types with no stripe charge id
      stripeChargeId: null,
    },
  });
  if (sampleTxCount > 0) {
    console.log(`Found ${sampleTxCount} sample transaction(s) (no Stripe charge ID) — these may be seed data.`);
    if (!DRY_RUN) {
      const result = await prisma.transaction.deleteMany({
        where: { type: { in: ['SUBSCRIPTION', 'COMMISSION'] }, provider: 'STRIPE', stripeChargeId: null },
      });
      console.log(`  => Deleted ${result.count} sample transaction(s)\n`);
    } else {
      console.log(`  => Would delete ${sampleTxCount} sample transaction(s)\n`);
    }
  } else {
    console.log('No sample transactions found.');
  }

  console.log(DRY_RUN ? '\nDry run complete. Re-run without --dry-run to apply.' : '\nCleanup complete.');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
