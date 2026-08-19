import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class RolePackageRepository {
  constructor(private readonly prisma: PrismaService) {}

  assign(roleId: string, packageId: string) {
    return this.prisma.rolePackage.create({
      data: {
        roleId,
        packageId,
      },
      include: {
        package: true,
      },
    });
  }

  findByIds(roleId: string, packageId: string) {
    return this.prisma.rolePackage.findUnique({
      where: {
        roleId_packageId: {
          roleId,
          packageId,
        },
      },
    });
  }

  findByRole(roleId: string) {
    return this.prisma.rolePackage.findMany({
      where: {
        roleId,
      },
      include: {
        package: true,
      },
      orderBy: {
        package: {
          code: 'asc',
        },
      },
    });
  }

  remove(roleId: string, packageId: string) {
    return this.prisma.rolePackage.delete({
      where: {
        roleId_packageId: {
          roleId,
          packageId,
        },
      },
    });
  }
}
