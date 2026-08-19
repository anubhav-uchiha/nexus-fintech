import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface CreateRoleRegisterPermissionData {
  registrarRoleId: string;
  targetRoleId: string;
  isActive: boolean;
}

@Injectable()
export class RoleRegisterPermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateRoleRegisterPermissionData) {
    return await this.prisma.roleRegisterPermission.create({
      data,
      include: {
        registrarRole: true,
        targetRole: true,
      },
    });
  }

  async findByIds(registrarRoleId: string, targetRoleId: string) {
    return await this.prisma.roleRegisterPermission.findUnique({
      where: {
        registrarRoleId_targetRoleId: {
          registrarRoleId,
          targetRoleId,
        },
      },
    });
  }

  async findByRegistrar(registrarRoleId: string) {
    return await this.prisma.roleRegisterPermission.findMany({
      where: {
        registrarRoleId,
      },
      include: {
        targetRole: true,
      },
      orderBy: {
        targetRole: {
          name: 'asc',
        },
      },
    });
  }

  async updateStatus(
    registrarRoleId: string,
    targetRoleId: string,
    isActive: boolean,
  ) {
    return await this.prisma.roleRegisterPermission.update({
      where: {
        registrarRoleId_targetRoleId: {
          registrarRoleId,
          targetRoleId,
        },
      },
      data: {
        isActive,
      },
      include: {
        registrarRole: true,
        targetRole: true,
      },
    });
  }

  async remove(registrarRoleId: string, targetRoleId: string) {
    return await this.prisma.roleRegisterPermission.delete({
      where: {
        registrarRoleId_targetRoleId: {
          registrarRoleId,
          targetRoleId,
        },
      },
    });
  }
}
