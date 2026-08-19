import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PackagePermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async assign(packageId: string, permissionId: string) {
    return await this.prisma.packagePermission.create({
      data: {
        packageId,
        permissionId,
      },
      include: {
        permission: true,
      },
    });
  }

  async findByIds(packageId: string, permissionId: string) {
    return await this.prisma.packagePermission.findUnique({
      where: {
        packageId_permissionId: {
          packageId,
          permissionId,
        },
      },
    });
  }

  async findByPackage(packageId: string) {
    return await this.prisma.packagePermission.findMany({
      where: {
        packageId,
      },
      include: {
        permission: true,
      },
      orderBy: {
        permission: {
          code: 'asc',
        },
      },
    });
  }

  async remove(packageId: string, permissionId: string) {
    return await this.prisma.packagePermission.delete({
      where: {
        packageId_permissionId: {
          packageId,
          permissionId,
        },
      },
    });
  }
}
