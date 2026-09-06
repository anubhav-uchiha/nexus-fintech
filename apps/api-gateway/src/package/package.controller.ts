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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import {
  CreatePackageDto,
  UpdatePackageDto,
  UpdatePackageStatusDto,
} from '@nexus/common/package';

import { AuthGatewayService } from '../auth/auth.gateway.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';
import { AssignPackagePermissionDto } from '@nexus/common/package-permission';

@ApiTags('Packages')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Access token is missing, invalid, expired, or the session is invalid',
})
@Controller('packages')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class PackageController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a package',
    description:
      'Creates a new package that can later be assigned to one or more roles.',
  })
  @ApiCreatedResponse({
    description: 'Package created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid package payload',
  })
  @ApiConflictResponse({
    description: 'A package with the same unique code already exists',
  })
  create(@Body() dto: CreatePackageDto) {
    return this.authGatewayService.createPackage(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all packages',
    description:
      'Returns all available packages and their current configuration.',
  })
  @ApiOkResponse({
    description: 'Packages retrieved successfully',
  })
  findAll() {
    return this.authGatewayService.findAllPackages();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get package by ID',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Package UUID',
  })
  @ApiOkResponse({
    description: 'Package retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Package not found',
  })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.authGatewayService.findPackageById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update package details',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Package UUID',
  })
  @ApiOkResponse({
    description: 'Package updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid package update payload',
  })
  @ApiNotFoundResponse({
    description: 'Package not found',
  })
  @ApiConflictResponse({
    description: 'Updated package data conflicts with an existing package',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.authGatewayService.updatePackage(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activate or deactivate a package',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Package UUID',
  })
  @ApiOkResponse({
    description: 'Package status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid package status payload',
  })
  @ApiNotFoundResponse({
    description: 'Package not found',
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageStatusDto,
  ) {
    return this.authGatewayService.updatePackageStatus(id, dto);
  }

  @Post(':packageId/permissions')
  @ApiOperation({
    summary: 'Assign a permission to a package',
    description: 'Adds an existing permission to the selected package.',
  })
  @ApiParam({
    name: 'packageId',
    format: 'uuid',
    description: 'Package UUID',
  })
  @ApiCreatedResponse({
    description: 'Permission assigned to package successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid package or permission data',
  })
  @ApiNotFoundResponse({
    description: 'Package or permission not found',
  })
  @ApiConflictResponse({
    description: 'Permission is already assigned to the package',
  })
  assignPermission(
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: AssignPackagePermissionDto,
  ) {
    return this.authGatewayService.assignPermissionToPackage(packageId, dto);
  }

  @Get(':packageId/permissions')
  @ApiOperation({
    summary: 'Get permissions assigned to a package',
  })
  @ApiParam({
    name: 'packageId',
    format: 'uuid',
    description: 'Package UUID',
  })
  @ApiOkResponse({
    description: 'Package permissions retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Package not found',
  })
  findPermissions(@Param('packageId', ParseUUIDPipe) packageId: string) {
    return this.authGatewayService.findPermissionsByPackage(packageId);
  }

  @Delete(':packageId/permissions/:permissionId')
  @ApiOperation({
    summary: 'Remove a permission from a package',
  })
  @ApiParam({
    name: 'packageId',
    format: 'uuid',
    description: 'Package UUID',
  })
  @ApiParam({
    name: 'permissionId',
    format: 'uuid',
    description: 'Permission UUID',
  })
  @ApiOkResponse({
    description: 'Permission removed from package successfully',
  })
  @ApiNotFoundResponse({
    description:
      'Package, permission, or package-permission assignment not found',
  })
  removePermission(
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.authGatewayService.removePermissionFromPackage(
      packageId,
      permissionId,
    );
  }
}
