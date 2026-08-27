import { ServerKafka } from '@nestjs/microservices';
import type { Admin, Kafka } from 'kafkajs';

type KafkaTopicError = Error & {
  retriable?: boolean;
  type?: string;
};

const TOPIC_CREATION_ERRORS = new Set([
  'UNKNOWN_TOPIC_OR_PARTITION',
  'LEADER_NOT_AVAILABLE',
]);

const delay = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Kafka creates missing topics asynchronously. KafkaJS 2.2 immediately bails
 * when the first metadata response says UNKNOWN_TOPIC_OR_PARTITION, even though
 * the broker has accepted the auto-creation request. Retry only subscription
 * on the same connected consumer until the new topics become available.
 */
export class AutoCreateTopicsServerKafka extends ServerKafka {
  constructor(options: ConstructorParameters<typeof ServerKafka>[0]) {
    super(options);

    // The project intentionally uses KafkaJS v2's default partitioner.
    process.env.KAFKAJS_NO_PARTITIONER_WARNING ??= '1';
  }

  override async bindEvents(
    consumer: Parameters<ServerKafka['bindEvents']>[0],
  ): Promise<void> {
    await this.ensureHandlerTopics();

    const maxAttempts = 10;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        await super.bindEvents(consumer);
        return;
      } catch (error) {
        const kafkaError = error as KafkaTopicError;
        const shouldRetry =
          kafkaError.retriable === true ||
          (kafkaError.type !== undefined &&
            TOPIC_CREATION_ERRORS.has(kafkaError.type));

        if (!shouldRetry || attempt === maxAttempts) {
          throw error;
        }

        const retryDelayMs = Math.min(attempt * 1_000, 5_000);
        this.logger.warn(
          `Kafka topics are still being created (${kafkaError.type ?? kafkaError.message}). ` +
            `Retrying subscription in ${retryDelayMs}ms (${attempt}/${maxAttempts}).`,
        );
        await delay(retryDelayMs);
      }
    }
  }

  private async ensureHandlerTopics(): Promise<void> {
    const topics = [...this.messageHandlers.keys()];

    if (topics.length === 0) {
      return;
    }

    if (!this.client) {
      throw new Error('Kafka client is not initialized');
    }

    const admin: Admin = (this.client as unknown as Kafka).admin();
    await admin.connect();

    try {
      const created = await admin.createTopics({
        topics: topics.map((topic) => ({
          topic,
          numPartitions: 1,
          replicationFactor: 1,
        })),
        waitForLeaders: true,
      });

      if (created) {
        this.logger.log(
          `Created missing Kafka handler topics: ${topics.join(', ')}`,
        );
      }
    } finally {
      await admin.disconnect();
    }
  }
}
