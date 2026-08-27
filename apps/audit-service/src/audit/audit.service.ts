import { Injectable } from '@nestjs/common';
import { CreateAuditLogDto } from '@nexus/common/audit/dto/create-audit-log.dto';
import { Prisma } from '../../generated/prisma/client';
import { AuditStatus } from '../../generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';
import { GetAuditLogsQueryDto } from '@nexus/common/audit';
import { GetAllAuditLogsQueryDto } from '@nexus/common/audit/dto/get-all-audit-logd-query.dto';
import { RpcException } from '@nestjs/microservices';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async createLog(dto: CreateAuditLogDto) {
    const data: Prisma.AuditLogCreateInput = {
      eventId: dto.eventId,
      identityId: dto.identityId,
      sessionId: dto.sessionId,
      loginId: dto.loginId,
      role: dto.role,
      service: dto.service.trim().toUpperCase(),
      action: dto.action.trim().toUpperCase(),
      status:
        dto.status === 'FAILED' ? AuditStatus.FAILED : AuditStatus.SUCCESS,
      httpMethod: dto.httpMethod,
      endpoint: dto.endpoint,
      statusCode: dto.statusCode,
      ipAddress: dto.ipAddress,
      ...(dto.metadata !== undefined && {
        metadata: dto.metadata as Prisma.InputJsonObject,
      }),
    };

    return this.prisma.auditLog.upsert({
      where: {
        eventId: dto.eventId,
      },
      update: {},
      create: data,
    });
  }

  async getMyLogs(identityId: string, query: GetAuditLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: Prisma.AuditLogWhereInput = {
      identityId,
      ...(query.service && {
        service: query.service,
      }),
      ...(query.action && {
        action: query.action,
      }),
      ...(query.status && {
        status:
          query.status === 'FAILED' ? AuditStatus.FAILED : AuditStatus.SUCCESS,
      }),
    };
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),
      this.prisma.auditLog.count({
        where,
      }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async getAllLogs(query: GetAllAuditLogsQueryDto) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);

    const where = {
      ...(query.identityId && { identityId: query.identityId }),
      ...(query.loginId && {
        loginId: query.loginId,
      }),
      ...(query.role && {
        role: query.role,
      }),
      ...(query.service && {
        service: query.action,
      }),
      ...(query.action && {
        action: query.action,
      }),
      ...(query.status && {
        status: query.status,
      }),
    };
    const [logs, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({
        where,
      }),
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
      data: logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  async getLogById(
    id: string,
    requesterIdentityId: string,
    requesterRole: string,
  ) {
    const log = await this.prisma.auditLog.findUnique({
      where: {
        id,
      },
    });

    if (!log) {
      throw new RpcException({
        statusCode: 404,
        message: 'Audit log not found',
      });
    }

    const isSuperAdmin = requesterRole === 'SUPER_ADMIN';
    const ownsLog =
      log.identityId !== null && log.identityId === requesterIdentityId;

    if (!isSuperAdmin && !ownsLog) {
      throw new RpcException({
        statusCode: 403,
        message: 'You are not allowed to view this audit log',
      });
    }

    return log;
  }
}
