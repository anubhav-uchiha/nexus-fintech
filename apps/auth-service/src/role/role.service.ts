import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RoleService {
  constructor(private readonly prisma: PrismaService) {}

  async findByName(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }
}
