import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  UpdatePermissionStatusDto,
} from '@nexus/common/permission';
import { PermissionRepository } from './repository/permission.repository';

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepository: PermissionRepository) {}

  async create(dto: CreatePermissionDto) {
    const code = this.normalizeCode(dto.code);

    const existingPermission = await this.permissionRepository.findByCode(code);

    if (existingPermission) {
      throw new ConflictException(`Permission ${code} already exists`);
    }

    try {
      return await this.permissionRepository.create({
        code,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        isActive: dto.isActive ?? true,
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(`Permission ${code} already exists`);
      }

      throw error;
    }
  }

  async findAll() {
    return await this.permissionRepository.findAll();
  }

  async findById(id: string) {
    const permission = await this.permissionRepository.findById(id);

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }

  async findByCode(code: string) {
    return await this.permissionRepository.findByCode(this.normalizeCode(code));
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const permission = await this.findById(id);

    const code =
      dto.code !== undefined ? this.normalizeCode(dto.code) : undefined;

    const name = dto.name?.trim();
    const description = dto.description?.trim();

    if (code === undefined && name === undefined && description === undefined) {
      throw new BadRequestException(
        'No permission fields were provided for update',
      );
    }

    const isChangingCode = code !== undefined && code !== permission.code;

    if (isChangingCode) {
      const packagePermissionCount =
        await this.permissionRepository.countPackagePermissions(id);

      if (packagePermissionCount > 0) {
        throw new ConflictException(
          'Permission code cannot be changed because packages already use this permission',
        );
      }

      const existingPermission =
        await this.permissionRepository.findByCode(code);

      if (existingPermission && existingPermission.id !== id) {
        throw new ConflictException(`Permission ${code} already exists`);
      }
    }

    try {
      return await this.permissionRepository.update(id, {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(`Permission ${code} already exists`);
      }

      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdatePermissionStatusDto) {
    await this.findById(id);

    return this.permissionRepository.updateStatus(id, dto.isActive);
  }

  private normalizeCode(code: string): string {
    return code.trim().toUpperCase().replace(/\s+/g, '_');
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }
}
