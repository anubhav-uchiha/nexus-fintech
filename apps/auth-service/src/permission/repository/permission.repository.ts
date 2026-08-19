import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface CreatePermissionData {
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
}

interface UpdatePermissionData {
  code?: string;
  name?: string;
  description?: string;
}

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePermissionData) {
    return await this.prisma.permission.create({
      data,
    });
  }

  async findAll() {
    return await this.prisma.permission.findMany({
      orderBy: {
        code: 'asc',
      },
    });
  }

  async findById(id: string) {
    return await this.prisma.permission.findUnique({
      where: {
        id,
      },
    });
  }

  async findByCode(code: string) {
    return await this.prisma.permission.findUnique({
      where: {
        code,
      },
    });
  }

  async countPackagePermissions(permissionId: string) {
    return await this.prisma.packagePermission.count({
      where: {
        permissionId,
      },
    });
  }

  async update(id: string, data: UpdatePermissionData) {
    return await this.prisma.permission.update({
      where: {
        id,
      },
      data,
    });
  }

  async updateStatus(id: string, isActive: boolean) {
    return await this.prisma.permission.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
    });
  }
}
