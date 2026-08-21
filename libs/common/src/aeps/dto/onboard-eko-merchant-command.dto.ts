import { IsUUID } from 'class-validator';
import { OnboardEkoUserDto } from './OnboardEkoUserDto';

export class OnboardEkoMerchantCommandDto extends OnboardEkoUserDto {
  @IsUUID()
  identityId!: string;
}
