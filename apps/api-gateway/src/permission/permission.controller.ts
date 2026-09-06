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
  CreatePermissionDto,
  UpdatePermissionDto,
  UpdatePermissionStatusDto,
} from '@nexus/common/permission';
import { AuthGatewayService } from '../auth/auth.gateway.service';
import { RpcToHttpExceptionInterceptor } from '../common/interceptors/rpc-to-http-exception';
import { JwtAuthGuard } from '../auth/guards/jwt-auth-guard';

@ApiTags('Permissions')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({
  description:
    'Access token is missing, invalid, expired, or the session is invalid',
})
@Controller('permissions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(RpcToHttpExceptionInterceptor)
export class PermissionController {
  constructor(private readonly authGatewayService: AuthGatewayService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a permission',
    description:
      'Creates a new atomic permission that can later be assigned to packages.',
  })
  @ApiCreatedResponse({
    description: 'Permission created successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid permission payload',
  })
  @ApiConflictResponse({
    description: 'A permission with the same unique code already exists',
  })
  async create(@Body() dto: CreatePermissionDto) {
    return await this.authGatewayService.createPermission(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all permissions',
    description:
      'Returns all permissions available in the authorization system.',
  })
  @ApiOkResponse({
    description: 'Permissions retrieved successfully',
  })
  async findAll() {
    return await this.authGatewayService.findAllPermissions();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get permission by ID',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Permission UUID',
  })
  @ApiOkResponse({
    description: 'Permission retrieved successfully',
  })
  @ApiNotFoundResponse({
    description: 'Permission not found',
  })
  async findById(@Param('id', new ParseUUIDPipe()) id: string) {
    return await this.authGatewayService.findPermissionById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a permission',
    description: 'Updates the editable details of an existing permission.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Permission UUID',
  })
  @ApiOkResponse({
    description: 'Permission updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid permission update payload',
  })
  @ApiNotFoundResponse({
    description: 'Permission not found',
  })
  @ApiConflictResponse({
    description: 'Updated permission data conflicts with another permission',
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
    description:
      'Updates whether the permission is active and available for effective authorization resolution.',
  })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Permission UUID',
  })
  @ApiOkResponse({
    description: 'Permission status updated successfully',
  })
  @ApiBadRequestResponse({
    description: 'Invalid permission status payload',
  })
  @ApiNotFoundResponse({
    description: 'Permission not found',
  })
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePermissionStatusDto,
  ) {
    return await this.authGatewayService.updatePermissionStatus(id, dto);
  }
}
