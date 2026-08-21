import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import {
  ChangeMpinDto,
  ChangePasswordDto,
  LoginDto,
  LogoutDto,
  RefreshTokenDto,
} from '@nexus/common';
import { AUTH_PATTERNS } from '@nexus/common/auth/auth.patterns';
import { ChangeLoginMethodDto } from '@nexus/common/auth/dto/change-login-method.dto';
import { ResetForgotPasswordDto } from '@nexus/common/auth/dto/forgot-password/reset-forgot-password.dto';
import { VerifyForgotPasswordOtpDto } from '@nexus/common/auth/dto/forgot-password/verify-forgot-password-otp.dto';
import { VerifyForgotPasswordUserDto } from '@nexus/common/auth/dto/forgot-password/verify-user.dto';
import {
  CreatePackageDto,
  PACKAGE_PATTERNS,
  UpdatePackageDto,
  UpdatePackageStatusDto,
} from '@nexus/common/package';
import {
  AssignPackagePermissionDto,
  PACKAGE_PERMISSION_PATTERNS,
} from '@nexus/common/package-permission';
import {
  CreatePermissionDto,
  PERMISSION_PATTERNS,
  UpdatePermissionDto,
  UpdatePermissionStatusDto,
} from '@nexus/common/permission';
import {
  CreateRoleDto,
  ROLE_PATTERNS,
  UpdateRoleDto,
  UpdateRoleStatusDto,
} from '@nexus/common/role';
import {
  AssignRolePackageDto,
  ROLE_PACKAGE_PATTERNS,
} from '@nexus/common/role-package';
import {
  CreateRoleRegisterPermissionDto,
  ROLE_REGISTER_PERMISSION_PATTERNS,
  UpdateRoleRegisterPermissionStatusDto,
} from '@nexus/common/role-register-permission';
import { firstValueFrom } from 'rxjs';
import { RequestMetadata } from './utils/request-metadata.util';

@Injectable()
export class AuthGatewayService implements OnModuleInit {
  constructor(
    @Inject('AUTH_SERVICE')
    private readonly client: ClientKafka,
  ) {}

  async onModuleInit() {
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_ROLE);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_SEND_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_VERIFY_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_PAN);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REGISTER_DETAILS);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.LOGIN);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.SEND_PHONE_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.SEND_EMAIL_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.VERIFY_PHONE_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.VERIFY_EMAIL_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.REFRESH_TOKEN);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.CHANGE_PASSWORD);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.CHANGE_MPIN);
    this.client.subscribeToResponseOf(
      AUTH_PATTERNS.FORGOT_PASSWORD_VERIFY_USER,
    );
    this.client.subscribeToResponseOf(AUTH_PATTERNS.FORGOT_PASSWORD_VERIFY_OTP);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.FORGOT_PASSWORD_RESET);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.LOGOUT);
    this.client.subscribeToResponseOf(AUTH_PATTERNS.CACHE_TEST);

    for (const pattern of Object.values(ROLE_PATTERNS)) {
      this.client.subscribeToResponseOf(pattern);
    }

    for (const pattern of Object.values(PERMISSION_PATTERNS)) {
      this.client.subscribeToResponseOf(pattern);
    }

    this.client.subscribeToResponseOf(PACKAGE_PATTERNS.CREATE);
    this.client.subscribeToResponseOf(PACKAGE_PATTERNS.FIND_ALL);
    this.client.subscribeToResponseOf(PACKAGE_PATTERNS.FIND_BY_ID);
    this.client.subscribeToResponseOf(PACKAGE_PATTERNS.UPDATE);
    this.client.subscribeToResponseOf(PACKAGE_PATTERNS.UPDATE_STATUS);

    this.client.subscribeToResponseOf(PACKAGE_PERMISSION_PATTERNS.ASSIGN);
    this.client.subscribeToResponseOf(
      PACKAGE_PERMISSION_PATTERNS.FIND_BY_PACKAGE,
    );
    this.client.subscribeToResponseOf(PACKAGE_PERMISSION_PATTERNS.REMOVE);

    this.client.subscribeToResponseOf(ROLE_PACKAGE_PATTERNS.ASSIGN);

    this.client.subscribeToResponseOf(ROLE_PACKAGE_PATTERNS.FIND_BY_ROLE);

    this.client.subscribeToResponseOf(ROLE_PACKAGE_PATTERNS.REMOVE);

    this.client.subscribeToResponseOf(ROLE_REGISTER_PERMISSION_PATTERNS.CREATE);

    this.client.subscribeToResponseOf(
      ROLE_REGISTER_PERMISSION_PATTERNS.FIND_BY_REGISTRAR,
    );

    this.client.subscribeToResponseOf(
      ROLE_REGISTER_PERMISSION_PATTERNS.UPDATE_STATUS,
    );

    this.client.subscribeToResponseOf(ROLE_REGISTER_PERMISSION_PATTERNS.REMOVE);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.RESOLVE_ROLE_PERMISSIONS);

    this.client.subscribeToResponseOf(
      AUTH_PATTERNS.RESOLVE_IDENTITY_PERMISSIONS,
    );

    this.client.subscribeToResponseOf(AUTH_PATTERNS.GET_SESSIONS);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.GET_SESSION);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REVOKE_SESSION);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REVOKE_OTHER_SESSIONS);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.REVOKE_ALL_SESSIONS);

    this.client.subscribeToResponseOf(AUTH_PATTERNS.VALIDATE_SESSION);

    await this.client.connect();
  }

  registerRole(dto: any) {
    console.log('Sending to kafka', dto);
    return firstValueFrom(this.client.send(AUTH_PATTERNS.REGISTER_ROLE, dto));
  }

  registerSendOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REGISTER_SEND_OTP, dto),
    );
  }

  registerVerifyOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REGISTER_VERIFY_OTP, dto),
    );
  }

  registerPan(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.REGISTER_PAN, dto));
  }

  registerDetails(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REGISTER_DETAILS, dto),
    );
  }

  changeLoginMethod(dto: ChangeLoginMethodDto, identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.CHANGE_LOGIN_METHOD, {
        identityId,
        ...dto,
      }),
    );
  }

  login(dto: LoginDto, metadata: RequestMetadata) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.LOGIN, {
        ...dto,
        ipAddress: metadata.ipAddress,

        userAgent: metadata.userAgent,

        device: metadata.device,
      }),
    );
  }

  sendPhoneOtp(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.SEND_PHONE_OTP, dto));
  }

  sendEmailOtp(dto: any) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.SEND_EMAIL_OTP, dto));
  }

  verifyPhoneOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.VERIFY_PHONE_OTP, dto),
    );
  }

  verifyEmailOtp(dto: any) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.VERIFY_EMAIL_OTP, dto),
    );
  }

  refreshToken(dto: RefreshTokenDto) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.REFRESH_TOKEN, dto));
  }

  changePassword(dto: ChangePasswordDto, identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.CHANGE_PASSWORD, {
        identityId,
        ...dto,
      }),
    );
  }

  changeMpin(dto: ChangeMpinDto, identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.CHANGE_MPIN, {
        identityId,
        ...dto,
      }),
    );
  }

  forgotPasswordVerifyUser(dto: VerifyForgotPasswordUserDto) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.FORGOT_PASSWORD_VERIFY_USER, dto),
    );
  }

  forgotPasswordVerifyOtp(dto: VerifyForgotPasswordOtpDto) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.FORGOT_PASSWORD_VERIFY_OTP, dto),
    );
  }

  forgotPasswordReset(dto: ResetForgotPasswordDto) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.FORGOT_PASSWORD_RESET, dto),
    );
  }

  logout(dto: LogoutDto) {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.LOGOUT, dto));
  }

  createRole(dto: CreateRoleDto) {
    return firstValueFrom(this.client.send(ROLE_PATTERNS.CREATE, dto));
  }

  findAllRoles() {
    return firstValueFrom(this.client.send(ROLE_PATTERNS.FIND_ALL, {}));
  }

  findRoleById(id: string) {
    return firstValueFrom(this.client.send(ROLE_PATTERNS.FIND_BY_ID, { id }));
  }

  updateRole(id: string, dto: UpdateRoleDto) {
    return firstValueFrom(
      this.client.send(ROLE_PATTERNS.UPDATE, { id, ...dto }),
    );
  }

  updateRoleStatus(id: string, dto: UpdateRoleStatusDto) {
    return firstValueFrom(
      this.client.send(ROLE_PATTERNS.UPDATE_STATUS, { id, ...dto }),
    );
  }

  createPermission(dto: CreatePermissionDto) {
    return firstValueFrom(this.client.send(PERMISSION_PATTERNS.CREATE, dto));
  }

  findAllPermissions() {
    return firstValueFrom(this.client.send(PERMISSION_PATTERNS.FIND_ALL, {}));
  }

  findPermissionById(id: string) {
    return firstValueFrom(
      this.client.send(PERMISSION_PATTERNS.FIND_BY_ID, {
        id,
      }),
    );
  }

  updatePermission(id: string, dto: UpdatePermissionDto) {
    return firstValueFrom(
      this.client.send(PERMISSION_PATTERNS.UPDATE, {
        id,
        ...dto,
      }),
    );
  }

  updatePermissionStatus(id: string, dto: UpdatePermissionStatusDto) {
    return firstValueFrom(
      this.client.send(PERMISSION_PATTERNS.UPDATE_STATUS, {
        id,
        ...dto,
      }),
    );
  }

  createPackage(dto: CreatePackageDto) {
    return firstValueFrom(this.client.send(PACKAGE_PATTERNS.CREATE, dto));
  }

  findAllPackages() {
    return firstValueFrom(this.client.send(PACKAGE_PATTERNS.FIND_ALL, {}));
  }

  findPackageById(id: string) {
    return firstValueFrom(
      this.client.send(PACKAGE_PATTERNS.FIND_BY_ID, { id }),
    );
  }

  updatePackage(id: string, dto: UpdatePackageDto) {
    return firstValueFrom(
      this.client.send(PACKAGE_PATTERNS.UPDATE, {
        id,
        ...dto,
      }),
    );
  }

  updatePackageStatus(id: string, dto: UpdatePackageStatusDto) {
    return firstValueFrom(
      this.client.send(PACKAGE_PATTERNS.UPDATE_STATUS, {
        id,
        ...dto,
      }),
    );
  }

  assignPermissionToPackage(
    packageId: string,
    dto: AssignPackagePermissionDto,
  ) {
    return firstValueFrom(
      this.client.send(PACKAGE_PERMISSION_PATTERNS.ASSIGN, {
        packageId,
        permissionId: dto.permissionId,
      }),
    );
  }

  findPermissionsByPackage(packageId: string) {
    return firstValueFrom(
      this.client.send(PACKAGE_PERMISSION_PATTERNS.FIND_BY_PACKAGE, {
        packageId,
      }),
    );
  }

  removePermissionFromPackage(packageId: string, permissionId: string) {
    return firstValueFrom(
      this.client.send(PACKAGE_PERMISSION_PATTERNS.REMOVE, {
        packageId,
        permissionId,
      }),
    );
  }

  assignPackageToRole(roleId: string, dto: AssignRolePackageDto) {
    return firstValueFrom(
      this.client.send(ROLE_PACKAGE_PATTERNS.ASSIGN, {
        roleId,
        packageId: dto.packageId,
      }),
    );
  }

  findPackagesByRole(roleId: string) {
    return firstValueFrom(
      this.client.send(ROLE_PACKAGE_PATTERNS.FIND_BY_ROLE, {
        roleId,
      }),
    );
  }

  removePackageFromRole(roleId: string, packageId: string) {
    return firstValueFrom(
      this.client.send(ROLE_PACKAGE_PATTERNS.REMOVE, {
        roleId,
        packageId,
      }),
    );
  }

  createRoleRegisterPermission(
    registrarRoleId: string,
    dto: CreateRoleRegisterPermissionDto,
  ) {
    return firstValueFrom(
      this.client.send(ROLE_REGISTER_PERMISSION_PATTERNS.CREATE, {
        registrarRoleId,
        targetRoleId: dto.targetRoleId,
        isActive: dto.isActive,
      }),
    );
  }

  findRoleRegisterPermissions(registrarRoleId: string) {
    return firstValueFrom(
      this.client.send(ROLE_REGISTER_PERMISSION_PATTERNS.FIND_BY_REGISTRAR, {
        registrarRoleId,
      }),
    );
  }

  updateRoleRegisterPermissionStatus(
    registrarRoleId: string,
    targetRoleId: string,
    dto: UpdateRoleRegisterPermissionStatusDto,
  ) {
    return firstValueFrom(
      this.client.send(ROLE_REGISTER_PERMISSION_PATTERNS.UPDATE_STATUS, {
        registrarRoleId,
        targetRoleId,
        isActive: dto.isActive,
      }),
    );
  }

  removeRoleRegisterPermission(registrarRoleId: string, targetRoleId: string) {
    return firstValueFrom(
      this.client.send(ROLE_REGISTER_PERMISSION_PATTERNS.REMOVE, {
        registrarRoleId,
        targetRoleId,
      }),
    );
  }

  async resolveRolePermissions(roleId: string) {
    return await firstValueFrom(
      this.client.send(AUTH_PATTERNS.RESOLVE_ROLE_PERMISSIONS, {
        roleId,
      }),
    );
  }

  resolveIdentityPermissions(identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.RESOLVE_IDENTITY_PERMISSIONS, {
        identityId,
      }),
    );
  }

  getSessions(identityId: string, currentSessionId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.GET_SESSIONS, {
        identityId,

        currentSessionId,
      }),
    );
  }

  getSession(identityId: string, sessionId: string, currentSessionId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.GET_SESSION, {
        identityId,

        sessionId,

        currentSessionId,
      }),
    );
  }

  revokeSession(
    identityId: string,
    sessionId: string,
    currentSessionId: string,
  ) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REVOKE_SESSION, {
        identityId,

        sessionId,

        currentSessionId,
      }),
    );
  }

  revokeOtherSessions(identityId: string, currentSessionId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REVOKE_OTHER_SESSIONS, {
        identityId,

        currentSessionId,
      }),
    );
  }

  revokeAllSessions(identityId: string) {
    return firstValueFrom(
      this.client.send(AUTH_PATTERNS.REVOKE_ALL_SESSIONS, {
        identityId,
      }),
    );
  }

  validateSession(
    identityId: string,

    sessionId: string,
  ): Promise<{
    valid: boolean;
  }> {
    return firstValueFrom(
      this.client.send<{
        valid: boolean;
      }>(
        AUTH_PATTERNS.VALIDATE_SESSION,

        {
          identityId,

          sessionId,
        },
      ),
    );
  }

  cacheTest() {
    return firstValueFrom(this.client.send(AUTH_PATTERNS.CACHE_TEST, {}));
  }
}
