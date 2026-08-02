import * as winston from 'winston';

import {
  developmentFormat,
  productionFormat,
} from '../formatters/winston.format';

const isProduction = process.env.NODE_ENV === 'production';

export const winstonProvider = {
  level: isProduction ? 'info' : 'debug',

  format: isProduction ? productionFormat : developmentFormat,

  transports: [
    new winston.transports.Console({
      handleExceptions: true,
    }),
  ],

  exitOnError: false,
};
