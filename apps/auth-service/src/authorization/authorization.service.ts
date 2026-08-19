import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthorizationRepository } from './repository/authorization.repository';
import { UserStatus } from 'apps/auth-service/generated/prisma/enums';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly authorizationRepository: AuthorizationRepository,
  ) {}

  async resolveRolePermissions(roleId: string) {
    const role =
      await this.authorizationRepository.findRolePermissionGraph(roleId);

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    if (!role.isActive) {
      return {
        role: {
          id: role.id,
          name: role.name,
          isActive: false,
        },
        packages: [],
        permissions: [],
        permissionCodes: [],
      };
    }

    const activePackages = role.rolePackages
      .map((rolePackage) => rolePackage.package)
      .filter((packageRecord) => packageRecord.isActive)
      .sort((first, second) => first.code.localeCompare(second.code));

    const permissionMap = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        description: string | null;
      }
    >();

    for (const packageRecord of activePackages) {
      for (const packagePermission of packageRecord.packagePermissions) {
        const permission = packagePermission.permission;

        if (!permission.isActive) {
          continue;
        }

        permissionMap.set(permission.code, {
          id: permission.id,
          code: permission.code,
          name: permission.name,
          description: permission.description,
        });
      }
    }

    const permissions = Array.from(permissionMap.values()).sort(
      (first, second) => first.code.localeCompare(second.code),
    );

    return {
      role: {
        id: role.id,
        name: role.name,
        isActive: role.isActive,
      },

      packages: activePackages.map((packageRecord) => ({
        id: packageRecord.id,
        code: packageRecord.code,
        name: packageRecord.name,
      })),

      permissions,

      permissionCodes: permissions.map((permission) => permission.code),
    };
  }

  async resolveIdentityPermissions(identityId: string) {
    const identity =
      await this.authorizationRepository.findIdentityRole(identityId);

    if (!identity) {
      throw new UnauthorizedException('Identity not found');
    }

    if (identity.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('Identity is not active');
    }

    const authorization = await this.resolveRolePermissions(identity.roleId);

    return {
      identity: {
        id: identity.id,
        status: identity.status,
      },
      ...authorization,
    };
  }
}
