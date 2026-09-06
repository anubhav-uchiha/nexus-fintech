import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuthGatewayService } from '../auth/auth.gateway.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  UpdateRoleStatusDto,
} from '@nexus/common/role';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';
import { AssignRolePackageDto } from '@nexus/common/role-package';
import {
  CreateRoleRegisterPermissionDto,
  UpdateRoleRegisterPermissionStatusDto,
} from '@nexus/common/role-register-permission';
import { SuperAdminAuthGuard } from '../auth/guards/super-admin-auth.guard';
import { SuperAdminOnboardingGuard } from '../auth/guards/super-admin-onboarding.guard';

@ApiTags('Roles')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Super Admin access token is missing, invalid, expired, or the session is invalid',
})
@ApiForbiddenResponse({
  description:
    'Super Admin onboarding is incomplete or the authenticated account is not allowed to manage roles',
})
@Controller('roles')
@UseGuards(SuperAdminAuthGuard, SuperAdminOnboardingGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class RoleController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a role',
    description:
      'Creates a new role that can later be assigned packages and role-registration permissions.',
  })
  @ApiCreatedResponse({
    description: 'Role created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid role payload',
  })
  @ApiConflictResponse({
    description: 'A role with the same name or prefix already exists',
  })
  create(@Body() dto: CreateRoleDto) {
    return this.authGatewayService.createRole(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all roles',
  })
  @ApiOkResponse({
    description: 'Roles retrieved successfully',
  })
  findAll() {
    return this.authGatewayService.findAllRoles();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get role by ID',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Role UUID',
  })
  @ApiOkResponse({
    description: 'Role retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Role not found',
  })
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.authGatewayService.findRoleById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a role',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Role UUID',
  })
  @ApiOkResponse({
    description: 'Role updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid role update payload',
  })
  @ApiNotFoundResponse({
    description: 'Role not found',
  })
  @ApiConflictResponse({
    description: 'Updated role data conflicts with an existing role',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.authGatewayService.updateRole(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activate or deactivate a role',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Role UUID',
  })
  @ApiOkResponse({
    description: 'Role status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid role status payload',
  })
  @ApiNotFoundResponse({
    description: 'Role not found',
  })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleStatusDto,
  ) {
    return this.authGatewayService.updateRoleStatus(id, dto);
  }

  @Post(':roleId/packages')
  @ApiOperation({
    summary: 'Assign a package to a role',
    description:
      'Assigns an existing package to the selected role so that its permissions become available to that role.',
  })
  @ApiParam({
    name: 'roleId',
    format: 'uuid',
    description: 'Role UUID',
  })
  @ApiCreatedResponse({
    description: 'Package assigned to role successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid role or package assignment',
  })
  @ApiNotFoundResponse({
    description: 'Role or package not found',
  })
  @ApiConflictResponse({
    description: 'Package is already assigned to the role',
  })
  assignPackage(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignRolePackageDto,
  ) {
    return this.authGatewayService.assignPackageToRole(roleId, dto);
  }

  @Get(':roleId/packages')
  @ApiOperation({
    summary: 'Get packages assigned to a role',
  })
  @ApiParam({
    name: 'roleId',
    format: 'uuid',
    description: 'Role UUID',
  })
  @ApiOkResponse({
    description: 'Role packages retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Role not found',
  })
  findPackages(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.authGatewayService.findPackagesByRole(roleId);
  }

  @Delete(':roleId/packages/:packageId')
  @ApiOperation({
    summary: 'Remove a package from a role',
  })
  @ApiParam({
    name: 'roleId',
    format: 'uuid',
    description: 'Role UUID',
  })
  @ApiParam({
    name: 'packageId',
    format: 'uuid',
    description: 'Package UUID',
  })
  @ApiOkResponse({
    description: 'Package removed from role successfully',
  })
  @ApiNotFoundResponse({
    description: 'Role, package, or role-package assignment not found',
  })
  removePackage(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ) {
    return this.authGatewayService.removePackageFromRole(roleId, packageId);
  }

  @Post(':registrarRoleId/register-permissions')
  @ApiOperation({
    summary: 'Allow a role to register another role',
    description:
      'Creates a role-registration rule defining which target role the registrar role is allowed to create.',
  })
  @ApiParam({
    name: 'registrarRoleId',
    format: 'uuid',
    description: 'Registrar role UUID',
  })
  @ApiCreatedResponse({
    description: 'Role registration permission created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid role registration permission payload',
  })
  @ApiNotFoundResponse({
    description: 'Registrar role or target role not found',
  })
  @ApiConflictResponse({
    description: 'The registrar role already has this registration permission',
  })
  createRegisterPermission(
    @Param('registrarRoleId', ParseUUIDPipe)
    registrarRoleId: string,
    @Body() dto: CreateRoleRegisterPermissionDto,
  ) {
    return this.authGatewayService.createRoleRegisterPermission(
      registrarRoleId,
      dto,
    );
  }

  @Get(':registrarRoleId/register-permissions')
  @ApiOperation({
    summary: 'Get roles that a registrar role can create',
  })
  @ApiParam({
    name: 'registrarRoleId',
    format: 'uuid',
    description: 'Registrar role UUID',
  })
  @ApiOkResponse({
    description: 'Role registration permissions retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Registrar role not found',
  })
  findRegisterPermissions(
    @Param('registrarRoleId', ParseUUIDPipe)
    registrarRoleId: string,
  ) {
    return this.authGatewayService.findRoleRegisterPermissions(registrarRoleId);
  }

  @Patch(':registrarRoleId/register-permissions/:targetRoleId/status')
  @ApiOperation({
    summary: 'Activate or deactivate a role registration permission',
  })
  @ApiParam({
    name: 'registrarRoleId',
    format: 'uuid',
    description: 'Registrar role UUID',
  })
  @ApiParam({
    name: 'targetRoleId',
    format: 'uuid',
    description: 'Target role UUID',
  })
  @ApiOkResponse({
    description: 'Role registration permission status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid role registration permission status payload',
  })
  @ApiNotFoundResponse({
    description:
      'Role registration permission, registrar role, or target role not found',
  })
  updateRegisterPermissionStatus(
    @Param('registrarRoleId', ParseUUIDPipe)
    registrarRoleId: string,
    @Param('targetRoleId', ParseUUIDPipe)
    targetRoleId: string,
    @Body() dto: UpdateRoleRegisterPermissionStatusDto,
  ) {
    return this.authGatewayService.updateRoleRegisterPermissionStatus(
      registrarRoleId,
      targetRoleId,
      dto,
    );
  }

  @Delete(':registrarRoleId/register-permissions/:targetRoleId')
  @ApiOperation({
    summary: 'Remove a role registration permission',
  })
  @ApiParam({
    name: 'registrarRoleId',
    format: 'uuid',
    description: 'Registrar role UUID',
  })
  @ApiParam({
    name: 'targetRoleId',
    format: 'uuid',
    description: 'Target role UUID',
  })
  @ApiOkResponse({
    description: 'Role registration permission removed successfully',
  })
  @ApiNotFoundResponse({
    description:
      'Role registration permission, registrar role, or target role not found',
  })
  removeRegisterPermission(
    @Param('registrarRoleId', ParseUUIDPipe)
    registrarRoleId: string,
    @Param('targetRoleId', ParseUUIDPipe)
    targetRoleId: string,
  ) {
    return this.authGatewayService.removeRoleRegisterPermission(
      registrarRoleId,
      targetRoleId,
    );
  }

  @Get(':roleId/effective-permissions')
  @ApiOperation({
    summary: 'Resolve active permissions available to a role',
    description:
      'Resolves effective active permissions through Role → RolePackage → Package → PackagePermission → Permission.',
  })
  @ApiParam({
    name: 'roleId',
    format: 'uuid',
    description: 'Role UUID',
  })
  @ApiOkResponse({
    description: 'Effective role permissions resolved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Role not found',
  })
  resolveEffectivePermissions(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.authGatewayService.resolveRolePermissions(roleId);
  }
}
