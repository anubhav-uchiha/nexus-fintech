import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import {
  CreateRoleRegisterPermissionDto,
  UpdateRoleRegisterPermissionStatusDto,
} from '@nexus/common/role-register-permission';

import { RoleService } from '../role/role.service';
import { RoleRegisterPermissionRepository } from './repository/role-register-permission.repository';

@Injectable()
export class RoleRegisterPermissionService {
  constructor(
    private readonly repository: RoleRegisterPermissionRepository,
    private readonly roleService: RoleService,
  ) {}

  async create(registrarRoleId: string, dto: CreateRoleRegisterPermissionDto) {
    if (registrarRoleId === dto.targetRoleId) {
      throw new BadRequestException(
        'A role cannot be allowed to register itself',
      );
    }

    const [registrarRole, targetRole] = await Promise.all([
      this.roleService.findById(registrarRoleId),
      this.roleService.findById(dto.targetRoleId),
    ]);

    const existing = await this.repository.findByIds(
      registrarRoleId,
      dto.targetRoleId,
    );

    if (existing) {
      throw new ConflictException(
        `${registrarRole.name} is already configured to register ${targetRole.name}`,
      );
    }

    try {
      return await this.repository.create({
        registrarRoleId,
        targetRoleId: dto.targetRoleId,
        isActive: dto.isActive ?? true,
      });
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          `${registrarRole.name} is already configured to register ${targetRole.name}`,
        );
      }

      throw error;
    }
  }

  async findByRegistrar(registrarRoleId: string) {
    await this.roleService.findById(registrarRoleId);

    return this.repository.findByRegistrar(registrarRoleId);
  }

  async updateStatus(
    registrarRoleId: string,
    targetRoleId: string,
    dto: UpdateRoleRegisterPermissionStatusDto,
  ) {
    const existing = await this.repository.findByIds(
      registrarRoleId,
      targetRoleId,
    );

    if (!existing) {
      throw new NotFoundException('Role registration permission not found');
    }

    return this.repository.updateStatus(
      registrarRoleId,
      targetRoleId,
      dto.isActive,
    );
  }

  async remove(registrarRoleId: string, targetRoleId: string) {
    const existing = await this.repository.findByIds(
      registrarRoleId,
      targetRoleId,
    );

    if (!existing) {
      throw new NotFoundException('Role registration permission not found');
    }

    await this.repository.remove(registrarRoleId, targetRoleId);

    return {
      message: 'Role registration permission removed successfully',
      registrarRoleId,
      targetRoleId,
    };
  }

  private isPrismaError(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === code
    );
  }
}
