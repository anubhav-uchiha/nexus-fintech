import { Module } from '@nestjs/common';

import { PrismaModule } from '../database/prisma.module';
import { DigiLockerSessionService } from './digilocker-session.service';
import { ConfigModule } from '@nestjs/config';
import { DigiLockerCryptoService } from './digilocker-crypto.service';
import { DigiLockerAuthService } from './digilocker-auth.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [DigiLockerCryptoService, DigiLockerSessionService],
  exports: [DigiLockerSessionService, DigiLockerAuthService],
})
export class DigiLockerModule {}
