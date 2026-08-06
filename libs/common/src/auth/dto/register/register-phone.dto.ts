import { ApiProperty } from '@nestjs/swagger';
import { IsMobilePhone, IsString } from 'class-validator';

export class RegisterPhoneDto {
  @ApiProperty()
  @IsString()
  draftId!: string;

  @ApiProperty()
  @IsMobilePhone('en-IN')
  phoneNumber!: string;
}
