import { Module } from '@nestjs/common';
import { EkoService } from './eko.service';
import { EkoController } from './eko.controller';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'EKO_AEPS_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => {
          const brokers = (
            config.get<string>('KAFKA_BROKERS') ?? 'localhost:9092'
          )
            .split(',')
            .map((broker) => broker.trim())
            .filter(Boolean);

          return {
            transport: Transport.KAFKA,
            options: {
              client: {
                clientId: `${
                  config.get<string>('KAFKA_CLIENT_ID') ?? 'api-gateway'
                }-aeps-eko`,
                brokers,
              },
              consumer: {
                groupId:
                  config.get<string>('EKO_KAFKA_GROUP_ID') ??
                  'api-gateway-aeps-eko-consumer',
              },
            },
          };
        },
      },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  providers: [EkoService],
  controllers: [EkoController],

export class EkoModule {}
