import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { AuditPublisherService } from './audit-publisher.service';
import { CurrentUser } from '../auth/decorator/current-user.decorator';
import { JwtPayload } from 'apps/auth-service/src/auth/jwt/interfaces/jwt-payload.interface';
import { GetAuditLogsQueryDto } from '@nexus/common/audit';
import { GetAllAuditLogsQueryDto } from '@nexus/common/audit/dto/get-all-audit-logd-query.dto';
import { AuditService } from './../../../audit-service/src/audit/audit.service';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@Controller('audit')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class AuditController {
  constructor(private readonly auditService: AuditPublisherService) {}

  @Get('me')
  getMyLogs(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetAuditLogsQueryDto,
  ) {
    return this.auditService.getMyLogs(user.sub, query);
  }

  @Get('/me/:id')
  getLogById(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.auditService.getLogById(id, user.sub, user.role);
  }

  @Get()
  getAllLogs(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetAllAuditLogsQueryDto,
  ) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Only SUPER_ADMIN can view all audit logs');
    }
    return this.auditService.getAllLogs(query);
  }
}
