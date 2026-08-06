import { PrismaClient } from '../../generated/prisma/client';

export async function seedRoles(prisma: PrismaClient) {
  const roles = [
    {
      name: 'RETAILER',
      description: 'Retailer account',
    },
    {
      name: 'DISTRIBUTOR',
      description: 'Distributor account',
    },
    {
      name: 'ADMIN',
      description: 'Application administrator',
    },
    {
      name: 'SUPER_ADMIN',
      description: 'System super administrator',
    },
  ];

  await prisma.$transaction(
    roles.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: {},
        create: role,
      }),
    ),
  );

  console.log('✅ Roles seeded successfully.');
}
