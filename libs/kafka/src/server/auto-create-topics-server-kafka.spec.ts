import { AutoCreateTopicsServerKafka } from './auto-create-topics-server-kafka';

describe('AutoCreateTopicsServerKafka', () => {
  it('retries subscription while Kafka auto-creates missing topics', async () => {
    const server = new AutoCreateTopicsServerKafka({
      client: {
        clientId: 'test-service',
        brokers: ['localhost:9092'],
      },
      consumer: {
        groupId: 'test-service-group',
      },
    });

    server.addHandler('test.auto-created-topic', jest.fn());

    const topicCreationError = Object.assign(
      new Error('This server does not host this topic-partition'),
      {
        retriable: true,
        type: 'UNKNOWN_TOPIC_OR_PARTITION',
      },
    );
    const consumer = {
      subscribe: jest
        .fn()
        .mockRejectedValueOnce(topicCreationError)
        .mockResolvedValue(undefined),
      run: jest.fn().mockResolvedValue(undefined),
    };
    const admin = {
      connect: jest.fn().mockResolvedValue(undefined),
      createTopics: jest.fn().mockResolvedValue(true),
      disconnect: jest.fn().mockResolvedValue(undefined),
    };
    Object.assign(server, {
      consumer,
      client: { admin: jest.fn(() => admin) },
    });

    await server.bindEvents(consumer as never);

    expect(admin.createTopics).toHaveBeenCalledWith({
      topics: [
        {
          topic: 'test.auto-created-topic',
          numPartitions: 1,
          replicationFactor: 1,
        },
      ],
      waitForLeaders: true,
    });
    expect(consumer.subscribe).toHaveBeenCalledTimes(2);
    expect(consumer.run).toHaveBeenCalledTimes(1);
  });
});
