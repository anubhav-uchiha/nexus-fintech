import { Module } from '@nestjs/common';

import { ClientsModule, Transport } from '@nestjs/microservices';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { CommissionKafkaController } from './commission.kafka.controller';
import { CommissionService } from './commission.service';
import { PrismaService } from '../database/prisma.service';
import { CommissionRuleService } from './commission-rule.service';
import { CommissionDistributionService } from './commission-distribution.service';
import { CommissionHierarchyService } from './commission-hierarchy.service';

import {
  CommissionRoleValidationService,
  COMMISSION_AUTH_CLIENT,
} from './commission-role-validation.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: COMMISSION_AUTH_CLIENT,

        imports: [ConfigModule],

        inject: [ConfigService],

        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: 'commission-service-auth-client',

              brokers: [config.get('KAFKA_BROKER') ?? 'localhost:9092'],
            },

            consumer: {
              groupId: 'commission-service-auth-client',
            },
          },
        }),
      },
    ]),
  ],

  controllers: [CommissionKafkaController],

  providers: [
    CommissionService,

    CommissionRuleService,

    CommissionDistributionService,

    CommissionHierarchyService,

    CommissionRoleValidationService,

    PrismaService,
  ],

  exports: [CommissionService, CommissionRoleValidationService],
})
export class CommissionModule {}
