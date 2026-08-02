import { Inject, Injectable } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

@Injectable()
export class AppLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER)
    private readonly logger: Logger,
  ) {}

  log(message: string, meta?: Record<string, unknown>) {
    this.logger.info(message, meta);
  }

  error(message: string, trace?: unknown, meta?: Record<string, unknown>) {
    this.logger.error(message, {
      trace,
      ...meta,
    });
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: Record<string, unknown>) {
    this.logger.verbose(message, meta);
  }
}
