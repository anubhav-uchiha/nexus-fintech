import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

interface CreateRoleData {
  name: string;
  description?: string;
  prefix: string;
  lastLoginIdNumber: number;
  isActive: boolean;
}

interface UpdateRoleData {
  name?: string;
  description?: string;
  prefix?: string;
}

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateRoleData) {
    return this.prisma.role.create({
      data,
    });
  }

  findAll() {
    return this.prisma.role.findMany({
      orderBy: {
        name: 'asc',
      },
    });
  }

  findById(id: string) {
    return this.prisma.role.findUnique({
      where: {
        id,
      },
    });
  }
  findByName(name: string) {
    return this.prisma.role.findUnique({
      where: {
        name,
      },
    });
  }

  findByPrefix(prefix: string) {
    return this.prisma.role.findUnique({
      where: {
        prefix,
      },
    });
  }

  update(id: string, data: UpdateRoleData) {
    return this.prisma.role.update({
      where: {
        id,
      },
      data,
    });
  }

  countIdentities(roleId: string) {
    return this.prisma.identity.count({
      where: {
        roleId,
      },
    });
  }

  updateStatus(id: string, isActive: boolean) {
    return this.prisma.role.update({
      where: {
        id,
      },
      data: {
        isActive,
      },
    });
  }
}
