import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'apps/kyc-service/generated/kyc-prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    const databaseUrl = process.env.KYC_DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('KYC_DATABASE_URL is not configured for API Gateway');
    }

    super({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
      }),
    });
  }
  async onModuleInit() {
    await this.$connect();
    console.log('✅ KYC Database Connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
