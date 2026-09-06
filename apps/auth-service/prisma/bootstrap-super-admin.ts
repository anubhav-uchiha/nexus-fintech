import * as dotenv from 'dotenv';
import * as path from 'path';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  AccountOnboardingStatus,
  LoginMethod,
  PrismaClient,
  UserStatus,
} from '../generated/prisma/client';
import { generatePassword } from '../src/auth/utils/password-generator';
import { generateMpin } from '../src/auth/utils/mpin-generator';

dotenv.config({
  path: path.resolve('apps/auth-service/.env'),
});

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function main(): Promise<void> {
  console.log('Creating the primary Super Admin...');

  const fullName = requiredEnv('BOOTSTRAP_SUPER_ADMIN_FULL_NAME');
  const username = requiredEnv('BOOTSTRAP_SUPER_ADMIN_USERNAME').toLowerCase();
  const email = requiredEnv('BOOTSTRAP_SUPER_ADMIN_EMAIL').toLowerCase();
  const city = requiredEnv('BOOTSTRAP_SUPER_ADMIN_CITY');
  const state = requiredEnv('BOOTSTRAP_SUPER_ADMIN_STATE');
  const pincode = requiredEnv('BOOTSTRAP_SUPER_ADMIN_PINCODE');

  const role = await prisma.role.findUnique({
    where: {
      name: 'SUPER_ADMIN',
    },
  });

  if (!role) {
    throw new Error(
      'SUPER_ADMIN role was not found. Run the Auth role seeder first.',
    );
  }

  if (!role.isActive) {
    throw new Error('SUPER_ADMIN role is inactive');
  }

  const existingSuperAdmin = await prisma.superAdmin.findFirst({
    select: {
      id: true,
      loginId: true,
      email: true,
      isPrimary: true,
    },
  });

  if (existingSuperAdmin) {
    throw new Error(
      `A Super Admin already exists with login ID ${existingSuperAdmin.loginId}. Bootstrap refused.`,
    );
  }

  const duplicateIdentity = await prisma.identity.findFirst({
    where: {
      OR: [{ username }, { email }],
    },
    select: {
      id: true,
    },
  });

  if (duplicateIdentity) {
    throw new Error(
      'The username or email already belongs to an Identity account',
    );
  }

  const temporaryPassword = generatePassword();
  const temporaryMpin = generateMpin();

  const [hashedPassword, hashedMpin] = await Promise.all([
    argon2.hash(temporaryPassword),
    argon2.hash(temporaryMpin),
  ]);

  const temporaryCredentialsExpireAt = new Date(
    Date.now() + 24 * 60 * 60 * 1000,
  );

  const superAdmin = await prisma.$transaction(async (tx) => {
    const accountCreatedDuringBootstrap = await tx.superAdmin.findFirst({
      select: {
        loginId: true,
      },
    });

    if (accountCreatedDuringBootstrap) {
      throw new Error(
        `A Super Admin already exists with login ID ${accountCreatedDuringBootstrap.loginId}`,
      );
    }

    const updatedRole = await tx.role.update({
      where: {
        id: role.id,
      },
      data: {
        lastLoginIdNumber: {
          increment: 1,
        },
      },
      select: {
        id: true,
        prefix: true,
        lastLoginIdNumber: true,
      },
    });

    const loginId = `${updatedRole.prefix}${updatedRole.lastLoginIdNumber}`;

    return tx.superAdmin.create({
      data: {
        loginId,
        fullName,
        username,
        email,
        phoneNumber: null,
        aadhaarNumber: null,
        panNumber: null,
        password: hashedPassword,
        mpin: hashedMpin,
        shopName: null,
        shopAddress: null,
        shopCity: null,
        shopState: null,
        city,
        state,
        pincode,
        status: UserStatus.ACTIVE,
        isEmailVerified: false,
        isPhoneVerified: false,
        isPanVerified: false,
        preferredLoginMethod: LoginMethod.LOGIN_ID,
        onboardingStatus: AccountOnboardingStatus.CREDENTIALS_ISSUED,
        temporaryCredentialsExpireAt,
        roleId: updatedRole.id,
        isPrimary: true,
        createdBySuperAdminId: null,
      },
      select: {
        id: true,
        loginId: true,
        fullName: true,
        email: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });
  });

  console.log('');
  console.log('Primary Super Admin created successfully.');
  console.log('');
  console.log(`Account ID: ${superAdmin.id}`);
  console.log(`Name: ${superAdmin.fullName}`);
  console.log(`Role: ${superAdmin.role.name}`);
  console.log(`Email: ${superAdmin.email}`);
  console.log(`Login ID: ${superAdmin.loginId}`);
  console.log(`Temporary Password: ${temporaryPassword}`);
  console.log(`Temporary MPIN: ${temporaryMpin}`);
  console.log('');
  console.log(
    'Store these credentials securely. They will not be displayed again.',
  );
}

main()
  .catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Unknown bootstrap error';

    console.error(`Super Admin bootstrap failed: ${message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
