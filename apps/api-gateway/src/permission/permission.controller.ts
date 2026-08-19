import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  UpdatePermissionStatusDto,
} from '@nexus/common/permission';
import { AuthGatewayService } from '../auth/auth.gateway.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';

@ApiTags('Permissions')
@Controller('permissions')
// @UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class PermissionController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a permission',
  })
  async create(@Body() dto: CreatePermissionDto) {
    return await this.authGatewayService.createPermission(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all permissions',
  })
  async findAll() {
    return await this.authGatewayService.findAllPermissions();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get permission by ID',
  })
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return await this.authGatewayService.findPermissionById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a permission',
  })
  async update(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePermissionDto,
  ) {
    return await this.authGatewayService.updatePermission(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Activate or deactivate a permission',
  })
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePermissionStatusDto,
  ) {
    return await this.authGatewayService.updatePermissionStatus(id, dto);
  }
}
