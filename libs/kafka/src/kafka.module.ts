import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { KafkaService } from './services/kafka.service';
import { KafkaProducerService } from './services/kafka-producer.service';
import { KafkaConsumerService } from './services/kafka-consumer.service';

@Global()
@Module({
  imports: [
    ConfigModule,

    ClientsModule.registerAsync([
      {
        name: 'KAFKA_SERVICE',
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,

          options: {
            client: {
              clientId: config.get<string>('KAFKA_CLIENT_ID') ?? 'auth-service',

              brokers: [
                config.get<string>('KAFKA_BROKERS') ?? 'localhost:9092',
              ],
            },

            consumer: {
              groupId:
                config.get<string>('KAFKA_GROUP_ID') ?? 'auth-service-group',
            },
          },
        }),
      },
    ]),
  ],

  providers: [KafkaService, KafkaProducerService, KafkaConsumerService],

  exports: [
    ClientsModule,
    KafkaService,
    KafkaProducerService,
    KafkaConsumerService,
  ],
})
export class KafkaModule {}
