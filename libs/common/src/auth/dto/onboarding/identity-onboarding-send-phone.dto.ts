import { Transform } from 'class-transformer';
import { IsPhoneNumber } from 'class-validator';

export class IdentityOnboardingSendPhoneDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsPhoneNumber('IN')
  phoneNumber!: string;
}
