// Load .env so ADMIN_EMAIL / ADMIN_PASSWORD can be set there for local use.
try { require('dotenv').config(); } catch { /* dotenv optional */ }

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  // 1. Create Admin User. Email defaults to the platform owner; the password
  //    MUST be provided via ADMIN_PASSWORD (never hardcoded).
  const adminEmail = process.env.ADMIN_EMAIL || 'pmayeni1@icloud.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error(
      'Refusing to seed admin: set ADMIN_PASSWORD (≥12 chars) in the environment ' +
      '(e.g. booking-api/.env) before running this script. No default password is used. ' +
      `Admin email: ${adminEmail} (override with ADMIN_EMAIL).`,
    );
    process.exit(1);
  }
  if (adminPassword.length < 12) {
    console.error('Refusing to seed admin: ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Platform Admin',
        passwordHash,
        role: 'ADMIN',
        // Force a password change on first sign-in — the ADMIN_PASSWORD is a
        // temporary bootstrap credential.
        mustResetPassword: true,
      },
    });
    console.log(`Admin user created: ${adminEmail} (must reset password on first login)`);
  } else {
    console.log(`Admin user already exists: ${adminEmail} (no change)`);
  }

  // 2. Create some sample transactions if none exist
  const txCount = await prisma.transaction.count();
  if (txCount === 0) {
    const businesses = await prisma.business.findMany({ take: 5 });
    
    for (const biz of businesses) {
      // Add subscription
      await prisma.transaction.create({
        data: {
          businessId: biz.id,
          type: 'SUBSCRIPTION',
          amountCents: biz.plan === 'PRO' ? 4900 : 2900,
          status: 'COMPLETED',
          provider: 'STRIPE',
          createdAt: new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000),
        }
      });

      // Add some commissions
      for (let i = 0; i < 10; i++) {
        await prisma.transaction.create({
          data: {
            businessId: biz.id,
            type: 'COMMISSION',
            amountCents: Math.floor(Math.random() * 500) + 100,
            status: 'COMPLETED',
            provider: 'STRIPE',
            createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          }
        });
      }
    }
    console.log('Sample transactions created');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
