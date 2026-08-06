export interface KafkaMessage<T = any> {
  key?: string;
  value: T;
  headers?: Record<string, string>;
}
