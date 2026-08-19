import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AssignRolePackageDto } from '@nexus/common/role-package';

import { PackageService } from '../package/package.service';
import { RoleService } from '../role/role.service';
import { RolePackageRepository } from './repository/role-package.repository';

@Injectable()
export class RolePackageService {
  constructor(
    private readonly rolePackageRepository: RolePackageRepository,
    private readonly roleService: RoleService,
    private readonly packageService: PackageService,
  ) {}

  async assign(roleId: string, dto: AssignRolePackageDto) {
    const [role, packageRecord] = await Promise.all([
      this.roleService.findById(roleId),
      this.packageService.findById(dto.packageId),
    ]);

    const existing = await this.rolePackageRepository.findByIds(
      roleId,
      dto.packageId,
    );

    if (existing) {
      throw new ConflictException(
        `Package ${packageRecord.code} is already assigned to role ${role.name}`,
      );
    }

    try {
      return await this.rolePackageRepository.assign(roleId, dto.packageId);
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          `Package ${packageRecord.code} is already assigned to role ${role.name}`,
        );
      }

      throw error;
    }
  }

  async findByRole(roleId: string) {
    await this.roleService.findById(roleId);

    return this.rolePackageRepository.findByRole(roleId);
  }

  async remove(roleId: string, packageId: string) {
    const existing = await this.rolePackageRepository.findByIds(
      roleId,
      packageId,
    );

    if (!existing) {
      throw new NotFoundException('Role package assignment not found');
    }

    await this.rolePackageRepository.remove(roleId, packageId);

    return {
      message: 'Package removed from role successfully',
      roleId,
      packageId,
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
