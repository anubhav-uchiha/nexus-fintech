import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { createHash } from 'crypto';

import { PrismaService } from '../database/prisma.service';

import { CreateCommissionHierarchyDto } from '@nexus/common/commission/dto/create-commission-hierarchy.dto';

import { UpdateCommissionHierarchyDto } from '@nexus/common/commission/dto/update-commission-hierarchy.dto';

@Injectable()
export class CommissionHierarchyService {
  constructor(private readonly prisma: PrismaService) {}

  private throwRpc(statusCode: number, message: string): never {
    throw new RpcException({
      statusCode,
      message,
    });
  }

  /*
   * =====================================================
   * NORMALIZATION
   * =====================================================
   */

  private normalizeRole(value: string, fieldName: string): string {
    const normalized = value?.trim().toUpperCase();

    if (!normalized) {
      this.throwRpc(400, `${fieldName} is required`);
    }

    return normalized;
  }

  private normalizeServiceType(value?: string | null): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim().toUpperCase();

    return normalized || null;
  }

  private normalizeUserId(value: string, fieldName: string): string {
    const normalized = value?.trim();

    if (!normalized) {
      this.throwRpc(400, `${fieldName} is required`);
    }

    return normalized;
  }

  /*
   * =====================================================
   * KEYS
   * =====================================================
   */

  private createRelationshipKey(
    parentUserId: string,
    childUserId: string,
    serviceType?: string | null,
  ): string {
    return createHash('sha256')
      .update(
        [parentUserId.trim(), childUserId.trim(), serviceType ?? '*'].join('|'),
      )
      .digest('hex');
  }

  /*
   * One child can have only ONE ACTIVE
   * parent in the same hierarchy scope.
   */
  private createActiveScopeKey(
    childUserId: string,
    serviceType?: string | null,
  ): string {
    return createHash('sha256')
      .update([childUserId.trim(), serviceType ?? '*'].join('|'))
      .digest('hex');
  }

  /*
   * =====================================================
   * INTERNAL PARENT RESOLVER
   * =====================================================
   *
   * service-specific relationship first.
   *
   * If not configured:
   * global serviceType=null fallback.
   */

  private async resolveParentRecord(
    childUserId: string,
    serviceType?: string | null,
  ) {
    if (serviceType) {
      const specific = await this.prisma.commissionHierarchy.findFirst({
        where: {
          childUserId,

          serviceType,

          isActive: true,
        },
      });

      if (specific) {
        return specific;
      }
    }

    return this.prisma.commissionHierarchy.findFirst({
      where: {
        childUserId,

        serviceType: null,

        isActive: true,
      },
    });
  }

  /*
   * =====================================================
   * CYCLE PROTECTION
   * =====================================================
   *
   * Example invalid:
   *
   * Retailer A
   *   ↓
   * Distributor B
   *   ↓
   * Super C
   *   ↓
   * Retailer A   ❌
   */

  private async assertNoCircularHierarchy(
    childUserId: string,
    proposedParentUserId: string,
    serviceType?: string | null,
  ) {
    const MAX_DEPTH = 20;

    const visited = new Set<string>();

    visited.add(childUserId);

    let currentUserId = proposedParentUserId;

    let depth = 0;

    while (depth < MAX_DEPTH) {
      if (visited.has(currentUserId)) {
        this.throwRpc(
          409,
          `Circular commission hierarchy detected involving user ${currentUserId}`,
        );
      }

      visited.add(currentUserId);

      const parent = await this.resolveParentRecord(currentUserId, serviceType);

      if (!parent) {
        return;
      }

      currentUserId = parent.parentUserId;

      depth++;
    }

    this.throwRpc(
      409,
      `Commission hierarchy exceeds maximum depth of ${MAX_DEPTH}`,
    );
  }

  /*
   * =====================================================
   * CREATE
   * =====================================================
   */

  async createHierarchy(dto: CreateCommissionHierarchyDto) {
    const parentUserId = this.normalizeUserId(
      dto.parentUserId,
      'Parent user ID',
    );

    const childUserId = this.normalizeUserId(dto.childUserId, 'Child user ID');

    const parentRole = this.normalizeRole(dto.parentRole, 'Parent role');

    const childRole = this.normalizeRole(dto.childRole, 'Child role');

    const serviceType = this.normalizeServiceType(dto.serviceType);

    if (parentUserId === childUserId) {
      this.throwRpc(400, 'Parent and child cannot be the same user');
    }

    /*
     * Exact relationship identity.
     */
    const relationshipKey = this.createRelationshipKey(
      parentUserId,
      childUserId,
      serviceType,
    );

    /*
     * Active parent identity.
     */
    const activeScopeKey =
      dto.isActive === false
        ? null
        : this.createActiveScopeKey(childUserId, serviceType);

    /*
     * Existing exact relationship.
     */
    const existingRelationship =
      await this.prisma.commissionHierarchy.findUnique({
        where: {
          relationshipKey,
        },
      });

    if (existingRelationship) {
      if (!existingRelationship.isActive) {
        this.throwRpc(
          409,
          `This hierarchy relationship already exists but is inactive. Reactivate hierarchy ${existingRelationship.id} instead of creating a duplicate.`,
        );
      }

      this.throwRpc(
        409,
        `This hierarchy relationship already exists. Existing hierarchy: ${existingRelationship.id}`,
      );
    }

    /*
     * Current active parent in same scope.
     */
    if (activeScopeKey) {
      const activeParent = await this.prisma.commissionHierarchy.findUnique({
        where: {
          activeScopeKey,
        },
      });

      if (activeParent) {
        this.throwRpc(
          409,
          `User ${childUserId} already has an active parent for this hierarchy scope. Existing hierarchy: ${activeParent.id}`,
        );
      }
    }

    /*
     * Cycle check before create.
     */
    if (dto.isActive !== false) {
      await this.assertNoCircularHierarchy(
        childUserId,
        parentUserId,
        serviceType,
      );
    }

    try {
      return await this.prisma.commissionHierarchy.create({
        data: {
          parentUserId,

          parentRole,

          childUserId,

          childRole,

          serviceType,

          relationshipKey,

          activeScopeKey,

          isActive: dto.isActive ?? true,
        },
      });
    } catch (error: any) {
      /*
       * Concurrent requests final
       * DB protection.
       */
      if (error?.code === 'P2002') {
        if (activeScopeKey) {
          const active = await this.prisma.commissionHierarchy.findUnique({
            where: {
              activeScopeKey,
            },
          });

          if (active) {
            this.throwRpc(
              409,
              `User ${childUserId} already has an active parent for this hierarchy scope. Existing hierarchy: ${active.id}`,
            );
          }
        }

        const duplicate = await this.prisma.commissionHierarchy.findUnique({
          where: {
            relationshipKey,
          },
        });

        this.throwRpc(
          409,
          duplicate
            ? `Hierarchy relationship already exists. Existing hierarchy: ${duplicate.id}`
            : 'Hierarchy relationship already exists',
        );
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Failed to create commission hierarchy',
      });
    }
  }

  /*
   * =====================================================
   * LIST
   * =====================================================
   */

  async getHierarchies(serviceType?: string) {
    const normalizedServiceType =
      serviceType !== undefined
        ? this.normalizeServiceType(serviceType)
        : undefined;

    return this.prisma.commissionHierarchy.findMany({
      where:
        normalizedServiceType !== undefined
          ? {
              serviceType: normalizedServiceType,
            }
          : undefined,

      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /*
   * =====================================================
   * GET SINGLE
   * =====================================================
   */

  async getHierarchy(id: string) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Hierarchy ID is required');
    }

    const hierarchy = await this.prisma.commissionHierarchy.findUnique({
      where: {
        id,
      },
    });

    if (!hierarchy) {
      this.throwRpc(404, 'Commission hierarchy not found');
    }

    return hierarchy;
  }

  /*
   * =====================================================
   * GET PARENT
   * =====================================================
   */

  async getParent(childUserId: string, serviceType?: string) {
    const normalizedChildUserId = this.normalizeUserId(
      childUserId,
      'Child user ID',
    );

    const normalizedServiceType = this.normalizeServiceType(serviceType);

    return this.resolveParentRecord(
      normalizedChildUserId,
      normalizedServiceType,
    );
  }

  /*
   * =====================================================
   * RESOLVE FULL HIERARCHY
   * =====================================================
   */

  async resolveHierarchyForUser(sourceUserId: string, serviceType: string) {
    const normalizedSourceUserId = this.normalizeUserId(
      sourceUserId,
      'Source user ID',
    );

    const normalizedServiceType = this.normalizeServiceType(serviceType);

    if (!normalizedServiceType) {
      this.throwRpc(400, 'Service type is required');
    }

    const MAX_DEPTH = 20;

    const hierarchy: Array<{
      userId: string;

      role: string;

      level: number;
    }> = [];

    const visitedUsers = new Set<string>();

    /*
     * Source role gets replaced later
     * by trusted transaction context.
     */
    hierarchy.push({
      userId: normalizedSourceUserId,

      role: 'UNKNOWN',

      level: 0,
    });

    visitedUsers.add(normalizedSourceUserId);

    let currentUserId = normalizedSourceUserId;

    let level = 0;

    while (level < MAX_DEPTH) {
      const parent = await this.resolveParentRecord(
        currentUserId,
        normalizedServiceType,
      );

      if (!parent) {
        break;
      }

      if (visitedUsers.has(parent.parentUserId)) {
        this.throwRpc(
          409,
          `Circular commission hierarchy detected involving user ${parent.parentUserId}`,
        );
      }

      visitedUsers.add(parent.parentUserId);

      currentUserId = parent.parentUserId;

      level++;

      hierarchy.push({
        userId: currentUserId,

        role: parent.parentRole,

        level,
      });
    }

    if (level >= MAX_DEPTH) {
      this.throwRpc(
        409,
        `Commission hierarchy exceeds maximum depth of ${MAX_DEPTH}`,
      );
    }

    return hierarchy;
  }

  /*
   * =====================================================
   * GET CHILDREN
   * =====================================================
   */

  async getChildren(parentUserId: string, serviceType?: string) {
    const normalizedParentUserId = this.normalizeUserId(
      parentUserId,
      'Parent user ID',
    );

    const normalizedServiceType =
      serviceType !== undefined
        ? this.normalizeServiceType(serviceType)
        : undefined;

    return this.prisma.commissionHierarchy.findMany({
      where: {
        parentUserId: normalizedParentUserId,

        isActive: true,

        ...(normalizedServiceType !== undefined
          ? {
              serviceType: normalizedServiceType,
            }
          : {}),
      },

      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  /*
   * =====================================================
   * UPDATE
   * =====================================================
   *
   * Existing DTO currently:
   *
   * serviceType?
   * isActive?
   *
   * Parent/child identity deliberately
   * immutable through this update method.
   */

  async updateHierarchy(
    id: string,

    dto: UpdateCommissionHierarchyDto,
  ) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Hierarchy ID is required');
    }

    const existing = await this.getHierarchy(id);

    const serviceType =
      dto.serviceType !== undefined
        ? this.normalizeServiceType(dto.serviceType)
        : existing.serviceType;

    const isActive =
      dto.isActive !== undefined ? dto.isActive : existing.isActive;

    const relationshipKey = this.createRelationshipKey(
      existing.parentUserId,
      existing.childUserId,
      serviceType,
    );

    const activeScopeKey = isActive
      ? this.createActiveScopeKey(existing.childUserId, serviceType)
      : null;

    /*
     * Exact relationship collision.
     */
    const relationshipConflict =
      await this.prisma.commissionHierarchy.findUnique({
        where: {
          relationshipKey,
        },
      });

    if (relationshipConflict && relationshipConflict.id !== id) {
      this.throwRpc(
        409,
        `Another identical hierarchy relationship already exists. Existing hierarchy: ${relationshipConflict.id}`,
      );
    }

    /*
     * Active parent collision.
     */
    if (activeScopeKey) {
      const activeConflict = await this.prisma.commissionHierarchy.findUnique({
        where: {
          activeScopeKey,
        },
      });

      if (activeConflict && activeConflict.id !== id) {
        this.throwRpc(
          409,
          `User ${existing.childUserId} already has another active parent for this hierarchy scope. Existing hierarchy: ${activeConflict.id}`,
        );
      }

      await this.assertNoCircularHierarchy(
        existing.childUserId,
        existing.parentUserId,
        serviceType,
      );
    }

    try {
      return await this.prisma.commissionHierarchy.update({
        where: {
          id,
        },

        data: {
          serviceType,

          isActive,

          relationshipKey,

          activeScopeKey,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        this.throwRpc(
          409,
          'Another active or duplicate hierarchy relationship already exists for this scope',
        );
      }

      if (error instanceof RpcException) {
        throw error;
      }

      throw new RpcException({
        statusCode: 500,

        message: error?.message ?? 'Failed to update commission hierarchy',
      });
    }
  }

  /*
   * =====================================================
   * DELETE / DEACTIVATE
   * =====================================================
   */

  async deleteHierarchy(id: string) {
    if (!id?.trim()) {
      this.throwRpc(400, 'Hierarchy ID is required');
    }

    const existing = await this.getHierarchy(id);

    if (!existing.isActive) {
      return existing;
    }

    return this.prisma.commissionHierarchy.update({
      where: {
        id,
      },

      data: {
        isActive: false,

        /*
         * Releases one-active-parent
         * constraint for this child/scope.
         */
        activeScopeKey: null,
      },
    });
  }
}
