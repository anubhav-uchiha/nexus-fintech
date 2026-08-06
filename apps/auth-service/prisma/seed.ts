import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({
  path: path.resolve('apps/auth-service/.env'),
});

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { seedRoles } from './seeder/role.seeder';

console.log('DATABASE_URL =', process.env.DATABASE_URL);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log('🌱 Starting database seeding...\n');

  await seedRoles(prisma);

  console.log('\n✅ Database seeding completed.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
