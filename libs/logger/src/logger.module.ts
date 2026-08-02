import { Global, Module } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';

import { winstonProvider } from './providers/winston.provider';
import { AppLoggerService } from './services/logger.service';

@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonProvider)],
  providers: [AppLoggerService],
  exports: [AppLoggerService, WinstonModule],
})
export class LoggerModule {}
