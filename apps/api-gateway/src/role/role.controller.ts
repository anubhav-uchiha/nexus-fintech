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
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
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

@ApiTags('Roles')
@Controller('roles')
// @UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class RoleController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a role',
  })
  create(@Body() dto: CreateRoleDto) {
    return this.authGatewayService.createRole(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all roles',
  })
  findAll() {
    return this.authGatewayService.findAllRoles();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get role by ID',
  })
  findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.authGatewayService.findRoleById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a role',
  })
  update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.authGatewayService.updateRole(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Active or deactivate a role' })
  updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateRoleStatusDto,
  ) {
    return this.authGatewayService.updateRoleStatus(id, dto);
  }

  @Post(':roleId/packages')
  @ApiOperation({ summary: 'Assign a package to a role' })
  assignPackage(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: AssignRolePackageDto,
  ) {
    return this.authGatewayService.assignPackageToRole(roleId, dto);
  }

  @Get(':roleId/packages')
  @ApiOperation({ summary: 'Get packages assigned to a role' })
  findPackages(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.authGatewayService.findPackagesByRole(roleId);
  }

  @Delete(':roleId/packages/:packageId')
  @ApiOperation({ summary: 'Remove a package from a role' })
  removePackage(
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Param('packageId', ParseUUIDPipe) packageId: string,
  ) {
    return this.authGatewayService.removePackageFromRole(roleId, packageId);
  }

  @Post(':registrarRoleId/register-permissions')
  @ApiOperation({
    summary: 'Allow a role to register another role',
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
  })
  resolveEffectivePermissions(@Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.authGatewayService.resolveRolePermissions(roleId);
  }
}
