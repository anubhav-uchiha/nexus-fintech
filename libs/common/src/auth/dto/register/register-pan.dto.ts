import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class RegisterPanDto {
  @ApiProperty()
  @IsString()
  draftId!: string;

  @ApiProperty()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/)
  panNumber!: string;
}
