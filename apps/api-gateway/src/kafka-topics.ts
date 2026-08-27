import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';
import { COMMISSION_PATTERNS } from '@nexus/common/commission/commission.patterns';
import { BANK_PROVIDER_PATTERNS } from '@nexus/common/eko/eko.patterns';
import { BANK_ACCOUNT_PATTERNS } from '@nexus/common/identity-bank-account/identity-bank-account.patterns';
import { KYC_PATTERNS } from '@nexus/common/kyc/kyc.patterns';
import { PACKAGE_PATTERNS } from '@nexus/common/package/package.patterns';
import { PACKAGE_PERMISSION_PATTERNS } from '@nexus/common/package-permission/package-permission.patterns';
import { PERMISSION_PATTERNS } from '@nexus/common/permission/permission.patterns';
import { ROLE_PATTERNS } from '@nexus/common/role/role.patterns';
import { ROLE_PACKAGE_PATTERNS } from '@nexus/common/role-package/role-package.patterns';
import { ROLE_REGISTER_PERMISSION_PATTERNS } from '@nexus/common/role-register-permission/role-register-permission.patterns';
import { TRANSACTION_PATTERNS } from '@nexus/common/transaction/transaction.patterns';
import { WALLET_PATTERNS } from '@nexus/common/wallet/wallet.patterns';
import { Kafka } from 'kafkajs';

const responsePatternGroups = [
  AUTH_PATTERNS,
  BANK_ACCOUNT_PATTERNS,
  BANK_PROVIDER_PATTERNS,
  COMMISSION_PATTERNS,
  KYC_PATTERNS,
  PACKAGE_PATTERNS,
  PACKAGE_PERMISSION_PATTERNS,
  PERMISSION_PATTERNS,
  ROLE_PATTERNS,
  ROLE_PACKAGE_PATTERNS,
  ROLE_REGISTER_PERMISSION_PATTERNS,
  TRANSACTION_PATTERNS,
  WALLET_PATTERNS,
] as const;

export async function ensureKafkaReplyTopics(
  brokers: string[],
  partitionCount: number,
) {
  if (!Number.isInteger(partitionCount) || partitionCount < 1) {
    throw new Error('KAFKA_REPLY_TOPIC_PARTITIONS must be a positive integer');
  }

  const patterns = responsePatternGroups.flatMap((group) =>
    Object.values(group),
  );
  const replyTopics = [...new Set(patterns)].map((pattern) => ({
    topic: `${pattern}.reply`,
    numPartitions: partitionCount,
    replicationFactor: 1,
  }));

  const admin = new Kafka({
    clientId: 'api-gateway-topic-admin',
    brokers,
  }).admin();

  await admin.connect();
  try {
    const existingTopics = new Set(await admin.listTopics());
    const missingTopics = replyTopics.filter(
      ({ topic }) => !existingTopics.has(topic),
    );
    const existingReplyTopics = replyTopics.filter(({ topic }) =>
      existingTopics.has(topic),
    );

    if (missingTopics.length > 0) {
      await admin.createTopics({
        topics: missingTopics,
        waitForLeaders: true,
      });
    }

    if (existingReplyTopics.length > 0) {
      const metadata = await admin.fetchTopicMetadata({
        topics: existingReplyTopics.map(({ topic }) => topic),
      });
      const undersizedTopics = metadata.topics.filter(
        ({ partitions }) => partitions.length < partitionCount,
      );

      if (undersizedTopics.length > 0) {
        await admin.createPartitions({
          topicPartitions: undersizedTopics.map(({ name }) => ({
            topic: name,
            count: partitionCount,
          })),
        });
      }
    }

    if (missingTopics.length > 0) {
      console.log(
        `✅ Created ${missingTopics.length} Kafka reply topic(s) with ${partitionCount} partition(s)`,
      );
    }
  } finally {
    await admin.disconnect();
  }
}
