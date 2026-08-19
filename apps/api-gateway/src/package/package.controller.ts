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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

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
@ApiBearerAuth()
@Controller('packages')
// @UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class PackageController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post()
  @ApiOperation({ summary: 'Create a package' })
  create(@Body() dto: CreatePackageDto) {
    return this.authGatewayService.createPackage(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all packages' })
  findAll() {
    return this.authGatewayService.findAllPackages();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get package by ID' })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.authGatewayService.findPackageById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update package details' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageDto,
  ) {
    return this.authGatewayService.updatePackage(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Activate or deactivate a package' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePackageStatusDto,
  ) {
    return this.authGatewayService.updatePackageStatus(id, dto);
  }

  @Post(':packageId/permissions')
  @ApiOperation({ summary: 'Assign a permission to a package' })
  assignPermission(
    @Param('packageId', ParseUUIDPipe) packageId: string,
    @Body() dto: AssignPackagePermissionDto,
  ) {
    return this.authGatewayService.assignPermissionToPackage(packageId, dto);
  }

  @Get(':packageId/permissions')
  @ApiOperation({ summary: 'Get permissions assigned to a package' })
  findPermissions(@Param('packageId', ParseUUIDPipe) packageId: string) {
    return this.authGatewayService.findPermissionsByPackage(packageId);
  }

  @Delete(':packageId/permissions/:permissionId')
  @ApiOperation({ summary: 'Remove a permission from a package' })
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
