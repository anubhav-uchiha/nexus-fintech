import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: ConfigService) {
    const connectionString = configService.getOrThrow<string>('DATABASE_URL');

    const connectionTimeoutMillis = Number(
      configService.get<string | number>(
        'AUDIT_DATABASE_CONNECTION_TIMEOUT_MS',
      ) ?? 10_000,
    );

    const maxConnections = Number(
      configService.get<string | number>('AUDIT_DATABASE_MAX_CONNECTIONS') ??
        10,
    );

    const adapter = new PrismaPg({
      connectionString,

      connectionTimeoutMillis:
        Number.isInteger(connectionTimeoutMillis) && connectionTimeoutMillis > 0
          ? connectionTimeoutMillis
          : 10_000,

      max:
        Number.isInteger(maxConnections) && maxConnections > 0
          ? maxConnections
          : 10,
    });

    super({
      adapter,
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      await this.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1`;
        },
        {
          maxWait: 5_000,
          timeout: 10_000,
        },
      );

      this.logger.log('✅ Audit database connected and transaction verified');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown PostgreSQL connection error';

      this.logger.error(`❌ Audit database connection failed: ${message}`);

      try {
        await this.$disconnect();
      } catch {
        // Preserve the original connection error.
      }

      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();

      this.logger.log('Audit database disconnected successfully');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown PostgreSQL disconnection error';

      this.logger.error(`Audit database disconnection failed: ${message}`);
    }
  }
}
