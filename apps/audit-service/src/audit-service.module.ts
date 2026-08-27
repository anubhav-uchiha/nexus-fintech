import { Module } from '@nestjs/common';
import { AuditServiceController } from './audit-service.controller';
import { AuditServiceService } from './audit-service.service';
import { PrismaModule } from './database/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,

      envFilePath: [
        `apps/audit-service/.env.${process.env.NODE_ENV ?? 'development'}`,
        'apps/audit-service/.env',
      ],
    }),

    PrismaModule,
    AuditModule,
  ],
  controllers: [AuditServiceController],
  providers: [AuditServiceService],
})
export class AuditServiceModule {}
