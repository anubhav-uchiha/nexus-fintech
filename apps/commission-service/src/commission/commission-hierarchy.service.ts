import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateCommissionHierarchyDto } from '@nexus/common/commission/dto/create-commission-hierarchy.dto';
import { RpcException } from '@nestjs/microservices';
import { UpdateCommissionHierarchyDto } from '@nexus/common/commission/dto/update-commission-hierarchy.dto';

@Injectable()
export class CommissionHierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  async createHierarchy(dto: CreateCommissionHierarchyDto) {
    if (!dto.parentUserId?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Parent user ID is required',
      });
    }

    if (!dto.parentRole?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Parent role is required',
      });
    }

    if (!dto.childUserId?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Child user ID is required',
      });
    }

    if (!dto.childRole?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Child role is required',
      });
    }

    if (dto.parentUserId === dto.childUserId) {
      throw new RpcException({
        status: 400,
        message: 'Parent and child cannot be the same user',
      });
    }

    const existing = await this.prisma.commissionHierarchy.findFirst({
      where: {
        parentUserId: dto.parentUserId,
        childUserId: dto.childUserId,
        serviceType: dto.serviceType ?? null,
      },
    });

    if (existing) {
      throw new RpcException({
        status: 409,
        message: 'This hierarchy relationship already exists',
      });
    }

    const existingParent = await this.prisma.commissionHierarchy.findFirst({
      where: {
        childUserId: dto.childUserId,
        serviceType: dto.serviceType ?? null,
        isActive: true,
      },
    });

    if (existingParent) {
      throw new RpcException({
        status: 409,
        message: `User ${dto.childUserId} already has an active parent`,
      });
    }

    try {
      return await this.prisma.commissionHierarchy.create({
        data: {
          parentUserId: dto.parentUserId,
          parentRole: dto.parentRole,
          childUserId: dto.childUserId,
          childRole: dto.childRole,
          serviceType: dto.serviceType,
          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: any) {
      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Failed to create commission hierarchy',
      });
    }
  }

  async getHierarchies(serviceType?: string) {
    return this.prisma.commissionHierarchy.findMany({
      where: serviceType
        ? {
            serviceType,
          }
        : undefined,
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async getHierarchy(id: string) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Hierarchy ID is required',
      });
    }

    const hierarchy = await this.prisma.commissionHierarchy.findUnique({
      where: { id },
    });

    if (!hierarchy) {
      throw new RpcException({
        status: 404,
        message: 'Commission hierarchy not found',
      });
    }
    return hierarchy;
  }

  async getParent(childUserId: string, serviceType?: string) {
    if (!childUserId?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Child user ID is required',
      });
    }

    if (serviceType?.trim()) {
      const serviceSpecific = await this.prisma.commissionHierarchy.findFirst({
        where: {
          childUserId,
          serviceType,
          isActive: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (serviceSpecific) {
        return serviceSpecific;
      }
    }

    return this.prisma.commissionHierarchy.findFirst({
      where: {
        childUserId,
        serviceType: null,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async resolveHierarchyForUser(sourceUserId: string, serviceType: string) {
    if (!sourceUserId?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Source user ID is required',
      });
    }

    if (!serviceType?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Service type is required',
      });
    }

    const MAX_DEPTH = 20;

    const hierarchy: Array<{
      userId: string;
      role: string;
      level: number;
    }> = [];

    const visitedUsers = new Set<string>();

    let currentUserId = sourceUserId;
    let currentRole: string | undefined;
    let level = 0;

    // Add source user first.
    hierarchy.push({
      userId: sourceUserId,
      role: 'UNKNOWN',
      level: 0,
    });

    visitedUsers.add(sourceUserId);

    while (level < MAX_DEPTH) {
      const parent = await this.getParent(currentUserId, serviceType);

      if (!parent) {
        break;
      }

      if (visitedUsers.has(parent.parentUserId)) {
        throw new RpcException({
          status: 409,
          message:
            `Circular commission hierarchy detected involving user ` +
            `${parent.parentUserId}`,
        });
      }

      visitedUsers.add(parent.parentUserId);

      currentUserId = parent.parentUserId;
      currentRole = parent.parentRole;
      level++;

      hierarchy.push({
        userId: currentUserId,
        role: currentRole,
        level,
      });
    }

    if (level >= MAX_DEPTH) {
      throw new RpcException({
        status: 409,
        message: `Commission hierarchy exceeds maximum depth of ${MAX_DEPTH}`,
      });
    }

    return hierarchy;
  }

  async getChildren(parentUserId: string, serviceType?: string) {
    if (!parentUserId?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Parent user ID is required',
      });
    }
    return this.prisma.commissionHierarchy.findMany({
      where: {
        parentUserId,
        isActive: true,
        ...(serviceType !== undefined
          ? {
              serviceType,
            }
          : {}),
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }
  async updateHierarchy(id: string, dto: UpdateCommissionHierarchyDto) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Hierarchy ID is required',
      });
    }
    const existing = await this.getHierarchy(id);

    const newServiceType =
      dto.serviceType !== undefined ? dto.serviceType : existing.serviceType;

    const newIsActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;

    if (newIsActive) {
      const conflictingParent = await this.prisma.commissionHierarchy.findFirst(
        {
          where: {
            id: {
              not: id,
            },
            childUserId: existing.childUserId,
            serviceType: newServiceType ?? null,
            isActive: true,
          },
        },
      );

      if (conflictingParent) {
        throw new RpcException({
          status: 409,
          message:
            `User ${existing.childUserId} already has another active parent ` +
            `for this service scope`,
        });
      }
    }

    try {
      return await this.prisma.commissionHierarchy.update({
        where: {
          id,
        },
        data: {
          ...(dto.serviceType !== undefined && {
            serviceType: dto.serviceType,
          }),
          ...(dto.isActive !== undefined && {
            isActive: dto.isActive,
          }),
        },
      });
    } catch (error: any) {
      throw new RpcException({
        status: 500,
        message: error?.message ?? 'Failed to update commission hierarchy',
      });
    }
  }

  async deleteHierarchy(id: string) {
    if (!id?.trim()) {
      throw new RpcException({
        status: 400,
        message: 'Hierarchy ID is required',
      });
    }
    await this.getHierarchy(id);
    return this.prisma.commissionHierarchy.update({
      where: {
        id,
      },
      data: {
        isActive: false,
      },
    });
  }
}
