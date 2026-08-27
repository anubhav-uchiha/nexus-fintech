// import { Module } from '@nestjs/common';
// import { EkoService } from './eko.service';
// import { EkoController } from './eko.controller';
// import { ClientsModule, Transport } from '@nestjs/microservices';
// import { ConfigModule, ConfigService } from '@nestjs/config';
// import { AuthModule } from 'apps/api-gateway/src/auth/auth.module';

// @Module({
//   imports: [
//     AuthModule,
//     ClientsModule.registerAsync([
//       {
//         name: 'EKO_AEPS_SERVICE',
//         imports: [ConfigModule],
//         inject: [ConfigService],
//         useFactory: (config: ConfigService) => {
//           const brokers = (
//             config.get<string>('KAFKA_BROKERS') ??
//             config.get<string>('KAFKA_BROKER') ??
//             'localhost:9092'
//           )
//             .split(',')
//             .map((broker) => broker.trim())
//             .filter(Boolean);

//           return {
//             transport: Transport.KAFKA,
//             options: {
//               client: {
//                 clientId: 'api-gateway-aeps-eko',
//                 brokers,
//               },
//               consumer: {
//                 groupId: 'api-gateway-aeps-eko-consumer',
//               },
//             },
//           };
//         },
//       },
//     ]),
//   ],
//   controllers: [EkoController],
//   providers: [EkoService],
// })
// export class EkoModule {}
