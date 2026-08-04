import { IsString, Length, Matches } from 'class-validator';

export class ChangeMpinDto {
  @IsString()
  currentMpin!: string;

  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/, {
    message: 'MPIN must be exactly 4 digits',
  })
  newMpin!: string;
}
