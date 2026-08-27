import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import {
  AUDIT_PATTERNS,
  CreateAuditLogDto,
  GetAuditLogsQueryDto,
} from '@nexus/common/audit';
import { GetAllAuditLogsQueryDto } from '@nexus/common/audit/dto/get-all-audit-logd-query.dto';
import { randomUUID } from 'crypto';
import { firstValueFrom } from 'rxjs';

type AuditEventData = Omit<CreateAuditLogDto, 'eventId'>;

@Injectable()
export class AuditPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuditPublisherService.name);
  constructor(
    @Inject('AUDIT_SERVICE')
    private readonly client: ClientKafka,
  ) {}
  async onModuleInit(): Promise<void> {
    this.client.subscribeToResponseOf(AUDIT_PATTERNS.GET_MY_LOGS);
    this.client.subscribeToResponseOf(AUDIT_PATTERNS.GET_ALL_LOGS);
    this.client.subscribeToResponseOf(AUDIT_PATTERNS.GET_LOG_BY_ID);
    await this.client.connect();
    this.logger.log('Audit Kafka producer connected successfully');
  }
  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }
  async publish(data: AuditEventData): Promise<void> {
    const payload: CreateAuditLogDto = {
      eventId: randomUUID(),
      ...data,
    };
    await firstValueFrom(this.client.emit(AUDIT_PATTERNS.CREATE_LOG, payload));
  }

  getMyLogs(identityId: string, query: GetAuditLogsQueryDto) {
    return firstValueFrom(
      this.client.send(AUDIT_PATTERNS.GET_MY_LOGS, {
        identityId,
        query,
      }),
    );
  }

  getAllLogs(query: GetAllAuditLogsQueryDto) {
    return firstValueFrom(this.client.send(AUDIT_PATTERNS.GET_ALL_LOGS, query));
  }

  getLogById(id: string, requesterIdentityId: string, requesterRole: string) {
    return firstValueFrom(
      this.client.send(AUDIT_PATTERNS.GET_LOG_BY_ID, {
        id,
        requesterIdentityId,
        requesterRole,
      }),
    );
  }
}
