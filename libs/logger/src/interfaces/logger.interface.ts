export interface LogMeta {
  correlationId?: string;
  userId?: string;
  ip?: string;
  method?: string;
  path?: string;
  service?: string;
  [key: string]: unknown;
}
