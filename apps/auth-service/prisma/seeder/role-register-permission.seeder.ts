import { PrismaClient } from '../../generated/prisma/client';

const registrationRules: Record<string, string[]> = {
  SUPER_ADMIN: [
    'SUPER_ADMIN',
    'ADMIN',
    'MASTER_DISTRIBUTOR',
    'DISTRIBUTOR',
    'RETAILER',
  ],

  ADMIN: ['MASTER_DISTRIBUTOR', 'DISTRIBUTOR', 'RETAILER'],

  MASTER_DISTRIBUTOR: ['DISTRIBUTOR', 'RETAILER'],

  DISTRIBUTOR: ['RETAILER'],

  RETAILER: [],
};

export async function seedRoleRegisterPermissions(
  prisma: PrismaClient,
): Promise<void> {
  console.log('🌱 Seeding role registration permissions...');

  const requiredRoleNames = Array.from(
    new Set([
      ...Object.keys(registrationRules),
      ...Object.values(registrationRules).flat(),
    ]),
  );

  const roles = await prisma.role.findMany({
    where: {
      name: {
        in: requiredRoleNames,
      },
    },
    select: {
      id: true,
      name: true,
    },
  });

  const roleByName = new Map(roles.map((role) => [role.name, role]));

  const missingRoles = requiredRoleNames.filter(
    (roleName) => !roleByName.has(roleName),
  );

  if (missingRoles.length > 0) {
    throw new Error(
      `Cannot seed registration permissions. Missing roles: ${missingRoles.join(', ')}`,
    );
  }

  const registrarRoleIds = Object.keys(registrationRules).map(
    (roleName) => roleByName.get(roleName)!.id,
  );

  await prisma.$transaction(async (transaction) => {
    // Disable existing rules for these registrar roles so the seed
    // remains the source of truth.
    await transaction.roleRegisterPermission.updateMany({
      where: {
        registrarRoleId: {
          in: registrarRoleIds,
        },
      },
      data: {
        isActive: false,
      },
    });

    for (const [registrarName, targetNames] of Object.entries(
      registrationRules,
    )) {
      const registrarRole = roleByName.get(registrarName)!;

      for (const targetName of targetNames) {
        const targetRole = roleByName.get(targetName)!;

        await transaction.roleRegisterPermission.upsert({
          where: {
            registrarRoleId_targetRoleId: {
              registrarRoleId: registrarRole.id,
              targetRoleId: targetRole.id,
            },
          },
          update: {
            isActive: true,
          },
          create: {
            registrarRoleId: registrarRole.id,
            targetRoleId: targetRole.id,
            isActive: true,
          },
        });
      }
    }
  });

  console.log('✅ Role registration permissions seeded');
}
