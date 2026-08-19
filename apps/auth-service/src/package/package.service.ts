import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreatePackageDto,
  UpdatePackageDto,
  UpdatePackageStatusDto,
} from '@nexus/common/package';
import { PackageRepository } from './repository/package.repository';

@Injectable()
export class PackageService {
  constructor(private readonly packageRepository: PackageRepository) {}

  async create(dto: CreatePackageDto) {
    const code = this.normalizeCode(dto.code);

    const existingPackage = await this.packageRepository.findByCode(code);

    if (existingPackage) {
      throw new ConflictException(`Package ${code} already exists`);
    }

    try {
      return await this.packageRepository.create({
        code,
        name: dto.name.trim(),
        description: dto.description?.trim(),
        price: dto.price ?? '0.00',
        isActive: dto.isActive ?? true,
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(`Package ${code} already exists`);
      }

      throw error;
    }
  }

  async findAll() {
    return await this.packageRepository.findAll();
  }

  async findById(id: string) {
    const packageRecord = await this.packageRepository.findById(id);

    if (!packageRecord) {
      throw new NotFoundException('Package not found');
    }

    return packageRecord;
  }

  async findByCode(code: string) {
    return await this.packageRepository.findByCode(this.normalizeCode(code));
  }

  async update(id: string, dto: UpdatePackageDto) {
    const packageRecord = await this.findById(id);

    const code =
      dto.code !== undefined ? this.normalizeCode(dto.code) : undefined;

    const name = dto.name?.trim();
    const description = dto.description?.trim();
    const price = dto.price;

    if (
      code === undefined &&
      name === undefined &&
      description === undefined &&
      price === undefined
    ) {
      throw new BadRequestException(
        'No package fields were provided for update',
      );
    }

    const isChangingCode = code !== undefined && code !== packageRecord.code;

    if (isChangingCode) {
      const [rolePackageCount, packagePermissionCount] = await Promise.all([
        this.packageRepository.countRolePackages(id),
        this.packageRepository.countPackagePermissions(id),
      ]);

      if (rolePackageCount > 0 || packagePermissionCount > 0) {
        throw new ConflictException(
          'Package code cannot be changed because roles or permissions already use this package',
        );
      }

      const existingPackage = await this.packageRepository.findByCode(code);

      if (existingPackage && existingPackage.id !== id) {
        throw new ConflictException(`Package ${code} already exists`);
      }
    }

    try {
      return await this.packageRepository.update(id, {
        ...(code !== undefined && { code }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price }),
      });
    } catch (error: unknown) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException(
          `Package ${code ?? packageRecord.code} already exists`,
        );
      }

      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdatePackageStatusDto) {
    await this.findById(id);

    return this.packageRepository.updateStatus(id, dto.isActive);
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
