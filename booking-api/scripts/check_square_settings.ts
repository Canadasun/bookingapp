import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const businesses = await prisma.business.findMany();
  for (const b of businesses) {
    const settings = JSON.stringify(b.bookingPageSettings) + JSON.stringify(b.notificationSettings);
    if (settings.includes('Square') || settings.includes('Money goes straight to you')) {
      console.log(`Business ID: ${b.id}, Name: ${b.name}`);
      console.log('Settings:', settings);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
