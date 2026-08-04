import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class RegisterDetailsDto {
  @ApiProperty()
  @IsString()
  draftId!: string;

  @ApiProperty()
  @IsNotEmpty()
  fullName!: string;

  @ApiProperty()
  @Length(12, 12)
  aadhaarNumber!: string;

  @ApiProperty()
  @IsNotEmpty()
  username!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsNotEmpty()
  shopName!: string;

  @ApiProperty()
  @IsNotEmpty()
  shopAddress!: string;

  @ApiProperty()
  @IsNotEmpty()
  shopCity!: string;

  @ApiProperty()
  @IsNotEmpty()
  shopState!: string;

  @ApiProperty()
  @IsNotEmpty()
  city!: string;

  @ApiProperty()
  @IsNotEmpty()
  state!: string;

  @ApiProperty()
  @Length(6, 6)
  pincode!: string;
}
