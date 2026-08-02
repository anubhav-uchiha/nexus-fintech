import { format } from 'winston';

const { combine, timestamp, errors, json, colorize, printf } = format;

export const developmentFormat = combine(
  colorize({ all: true }),
  timestamp(),
  errors({ stack: true }),
  printf(({ timestamp, level, message, context, stack, ...meta }) => {
    return `${timestamp} [${level}]${context ? ` [${context}]` : ''} ${message}${
      stack ? `\n${stack}` : ''
    } ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''}`;
  }),
);

export const productionFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
);
