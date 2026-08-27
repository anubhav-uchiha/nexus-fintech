import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

function getPositiveInteger(name: string, fallback: number): number {
  const value = Number(process.env[name] ?? fallback);

  if (!Number.isInteger(value) || value <= 0) {
    return fallback;
  }

  return value;
}

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required');
    }
    const adapter = new PrismaPg({
      connectionString,

      max: getPositiveInteger('AUTH_DB_POOL_MAX', 10),

      connectionTimeoutMillis: getPositiveInteger(
        'AUTH_DB_CONNECTION_TIMEOUT_MS',
        5000,
      ),
      idleTimeoutMillis: getPositiveInteger('AUTH_DB_IDLE_TIMEOUT_MS', 30000),
    });

    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    console.log('✅ Auth Database Connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
