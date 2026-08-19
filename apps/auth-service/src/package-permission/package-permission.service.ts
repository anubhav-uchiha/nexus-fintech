import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { AssignPackagePermissionDto } from '@nexus/common/package-permission';

import { PackageService } from '../package/package.service';
import { PermissionService } from '../permission/permission.service';
import { PackagePermissionRepository } from './repository/package-permission.repository';

@Injectable()
export class PackagePermissionService {
  constructor(
    private readonly packagePermissionRepository: PackagePermissionRepository,
    private readonly packageService: PackageService,
    private readonly permissionService: PermissionService,
  ) {}

  async assign(packageId: string, dto: AssignPackagePermissionDto) {
    const [packageRecord, permission] = await Promise.all([
      this.packageService.findById(packageId),
      this.permissionService.findById(dto.permissionId),
    ]);

    const existing = await this.packagePermissionRepository.findByIds(
      packageId,
      dto.permissionId,
    );

    if (existing) {
      throw new ConflictException(
        `Permission ${permission.code} is already assigned to package ${packageRecord.code}`,
      );
    }

    try {
      return await this.packagePermissionRepository.assign(
        packageId,
        dto.permissionId,
      );
    } catch (error) {
      if (this.isPrismaError(error, 'P2002')) {
        throw new ConflictException(
          `Permission ${permission.code} is already assigned to package ${packageRecord.code}`,
        );
      }

      throw error;
    }
  }

  async findByPackage(packageId: string) {
    await this.packageService.findById(packageId);

    return this.packagePermissionRepository.findByPackage(packageId);
  }

  async remove(packageId: string, permissionId: string) {
    const existing = await this.packagePermissionRepository.findByIds(
      packageId,
      permissionId,
    );

    if (!existing) {
      throw new NotFoundException('Package permission assignment not found');
    }

    await this.packagePermissionRepository.remove(packageId, permissionId);

    return {
      message: 'Permission removed from package successfully',
      packageId,
      permissionId,
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
