import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from 'apps/kyc-service/generated/kyc-prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL!,
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
