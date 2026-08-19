import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuthorizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findRolePermissionGraph(roleId: string) {
    return this.prisma.role.findUnique({
      where: {
        id: roleId,
      },
      select: {
        id: true,
        name: true,
        isActive: true,

        rolePackages: {
          select: {
            package: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,

                packagePermissions: {
                  select: {
                    permission: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        description: true,
                        isActive: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  findIdentityRole(identityId: string) {
    return this.prisma.identity.findUnique({
      where: {
        id: identityId,
      },
      select: {
        id: true,
        status: true,
        roleId: true,
      },
    });
  }
}
