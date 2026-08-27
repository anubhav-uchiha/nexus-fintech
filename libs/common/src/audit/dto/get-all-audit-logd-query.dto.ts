import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { GetAuditLogsQueryDto } from './get-audit-logs-query.dto';
import { Transform } from 'class-transformer';

export class GetAllAuditLogsQueryDto extends GetAuditLogsQueryDto {
  @IsOptional()
  @IsUUID()
  identityId?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(50)
  loginId?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(50)
  role?: string;
}
