import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRoleStatusDto,
} from '@nexus/common/role';
import { RoleRepository } from './repository/role.repository';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateRoleDto) {
    const name = dto.name.trim().toUpperCase().replace(/\s+/g, '_');
    const prefix = dto.prefix.trim().toUpperCase();

    const existingName = await this.roleRepository.findByName(name);
    if (existingName) {
      throw new ConflictException(`Role ${name} already exists`);
    }

    const existingPrefix = await this.roleRepository.findByPrefix(prefix);

    if (existingPrefix) {
      throw new ConflictException(`Prefix ${prefix} is alredy in use`);
    }

    try {
      return await this.roleRepository.create({
        name,
        prefix,
        description: dto.description?.trim(),
        lastLoginIdNumber: dto.startingLoginIdNumber ?? 1000,
        isActive: dto.isActive ?? true,
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Role name or prefix already exists');
      }
      throw error;
    }
  }

  async findAll() {
    return await this.roleRepository.findAll();
  }

  async findById(id: string) {
    const role = await this.roleRepository.findById(id);

    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async findByName(name: string) {
    return await this.roleRepository.findByName(name);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.findById(id);
    const name = dto.name
      ? dto.name.trim().toUpperCase().replace(/\s+/g, '_')
      : undefined;

    const prefix = dto.prefix ? dto.prefix.trim().toUpperCase() : undefined;

    const description = dto.description?.trim();

    if (
      name === undefined &&
      prefix === undefined &&
      description === undefined
    ) {
      throw new BadRequestException('No role fields were provided for update');
    }

    const isChangingName = name !== undefined && name !== role.name;

    const isChangingPrefix = prefix !== undefined && prefix !== role.prefix;

    if (isChangingName || isChangingPrefix) {
      const identityCount = await this.roleRepository.countIdentities(id);

      if (identityCount > 0) {
        throw new ConflictException(
          'Role name and prefix cannot be changed because identities already use this role',
        );
      }
    }
    if (isChangingName) {
      const existingName = await this.roleRepository.findByName(name);

      if (existingName && existingName.id !== id) {
        throw new ConflictException(`Role ${name} already exists`);
      }
    }

    if (isChangingPrefix) {
      const existingPrefix = await this.roleRepository.findByPrefix(prefix);

      if (existingPrefix && existingPrefix.id !== id) {
        throw new ConflictException(`Prefix ${prefix} is already in use`);
      }
    }

    try {
      return this.roleRepository.update(id, {
        ...(name !== undefined && { name }),
        ...(prefix !== undefined && { prefix }),
        ...(description !== undefined && { description }),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Role name or prefix already exists');
      }

      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdateRoleStatusDto) {
    await this.findById(id);

    return this.roleRepository.updateStatus(id, dto.isActive);
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    );
  }

  async assertCanRegisterRole(registrarRoleId: string, targetRoleName: string) {
    const normalizedTargetRoleName = targetRoleName
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

    const targetRole = await this.prisma.role.findUnique({
      where: {
        name: normalizedTargetRoleName,
      },
    });

    if (!targetRole) {
      throw new BadRequestException('Target role does not exist');
    }

    if (!targetRole.isActive) {
      throw new BadRequestException('Target role is inactive');
    }

    const registrationPermission =
      await this.prisma.roleRegisterPermission.findUnique({
        where: {
          registrarRoleId_targetRoleId: {
            registrarRoleId,
            targetRoleId: targetRole.id,
          },
        },
        select: {
          isActive: true,
        },
      });

    if (!registrationPermission?.isActive) {
      throw new ForbiddenException(
        `Your role is not allowed to create ${targetRole.name} accounts`,
      );
    }

    return targetRole;
  }
}
