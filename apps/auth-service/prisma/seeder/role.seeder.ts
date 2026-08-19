import { PrismaClient } from '../../generated/prisma/client';

export async function seedRoles(prisma: PrismaClient) {
  const roles = [
    {
      name: 'SUPER_ADMIN',
      description: 'System super administrator',
      prefix: 'SA',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'ADMIN',
      description: 'Application administrator',
      prefix: 'ADMIN',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'WHITE_LABEL',
      description: 'White label account',
      prefix: 'WL',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'MASTER_DISTRIBUTOR',
      description: 'Master distributor account',
      prefix: 'UMD',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'DISTRIBUTOR',
      description: 'Distributor account',
      prefix: 'UDT',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'RETAILER',
      description: 'Retailer account',
      prefix: 'KRT',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'CLIENT',
      description: 'Client account',
      prefix: 'CR',
      lastLoginIdNumber: 1000,
      isActive: false,
    },
    {
      name: 'TSM',
      description: 'Territory sales manager',
      prefix: 'TSM',
      lastLoginIdNumber: 1000,
      isActive: false,
    },
    {
      name: 'ASM',
      description: 'Area sales manager',
      prefix: 'ASM',
      lastLoginIdNumber: 1000,
      isActive: false,
    },
    {
      name: 'EMPLOYEE',
      description: 'Employee account',
      prefix: 'EP',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'ACCOUNT',
      description: 'Accounts department account',
      prefix: 'ACC',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
    {
      name: 'AEPS_TEAM',
      description: 'AEPS operations team',
      prefix: 'AEPS',
      lastLoginIdNumber: 1000,
      isActive: true,
    },
  ];

  await prisma.$transaction(
    roles.map((role) =>
      prisma.role.upsert({
        where: { name: role.name },
        update: {
          description: role.description,
        },
        create: role,
      }),
    ),
  );

  console.log('✅ Roles seeded successfully.');
}
