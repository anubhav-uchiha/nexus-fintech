import {
  IsIn,
  IsInt,
  IsIP,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAuditLogDto {
  @IsUUID()
  eventId!: string;

  @IsOptional()
  @IsUUID()
  identityId?: string;

  @IsOptional()
  @IsUUID()
  sessionId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  loginId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  service!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action!: string;

  @IsIn(['SUCCESS', 'FAILED'])
  status!: 'SUCCESS' | 'FAILED';

  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])
  httpMethod?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  endpoint?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @IsOptional()
  @IsIP()
  ipAddress?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
