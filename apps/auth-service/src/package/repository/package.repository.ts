import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface CreatePackageData {
  code: string;
  name: string;
  description?: string;
  price: string;
  isActive: boolean;
}

interface UpdatePackageData {
  code?: string;
  name?: string;
  description?: string;
  price?: string;
}

@Injectable()
export class PackageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePackageData) {
    return await this.prisma.package.create({
      data,
    });
  }

  async findAll() {
    return await this.prisma.package.findMany({
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findById(id: string) {
    return await this.prisma.package.findUnique({
      where: {
        id,
      },
    });
  }

  async findByCode(code: string) {
    return await this.prisma.package.findUnique({
      where: {
        code,
      },
    });
  }

  async countRolePackages(packageId: string) {
    return await this.prisma.rolePackage.count({
      where: {
        packageId,
      },
    });
  }

  async countPackagePermissions(packageId: string) {
    return await this.prisma.packagePermission.count({
      where: {
        packageId,
      },
    });
  }

  async update(id: string, data: UpdatePackageData) {
    return await this.prisma.package.update({
      where: {
        id,
      },
      data,
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return await this.prisma.package.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
    });
  }
}
