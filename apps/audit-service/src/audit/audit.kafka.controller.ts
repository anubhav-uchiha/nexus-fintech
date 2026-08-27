import { Controller } from '@nestjs/common';
import { AuditService } from './audit.service';
import { EventPattern, MessagePattern, Payload } from '@nestjs/microservices';
import {
  AUDIT_PATTERNS,
  CreateAuditLogDto,
  GetAuditLogsQueryDto,
} from '@nexus/common/audit';
import { GetAllAuditLogsQueryDto } from '@nexus/common/audit/dto/get-all-audit-logd-query.dto';

@Controller()
export class AuditKafkaController {
  constructor(private readonly auditService: AuditService) {}

  @EventPattern(AUDIT_PATTERNS.CREATE_LOG)
  async createLog(@Payload() dto: CreateAuditLogDto) {
    return this.auditService.createLog(dto);
  }

  @MessagePattern(AUDIT_PATTERNS.GET_MY_LOGS)
  getMyLogs(
    @Payload() payload: { identityId: string; query: GetAuditLogsQueryDto },
  ) {
    return this.auditService.getMyLogs(payload.identityId, payload.query);
  }

  @MessagePattern(AUDIT_PATTERNS.GET_ALL_LOGS)
  getAllLogs(@Payload() query: GetAllAuditLogsQueryDto) {
    return this.auditService.getAllLogs(query);
  }

  @MessagePattern(AUDIT_PATTERNS.GET_LOG_BY_ID)
  getLogById(
    @Payload()
    payload: {
      id: string;
      requesterIdentityId: string;
      requesterRole: string;
    },
  ) {
    return this.auditService.getLogById(
      payload.id,
      payload.requesterIdentityId,
      payload.requesterRole,
    );
  }
}
