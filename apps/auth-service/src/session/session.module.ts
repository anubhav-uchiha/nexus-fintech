import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { SessionService } from './session.service';
import { SessionKafkaController } from './session.kafka.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SessionKafkaController],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
