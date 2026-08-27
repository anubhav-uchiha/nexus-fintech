import { IsNotEmpty, IsString } from 'class-validator';

export class VimopayEkycDto {
  /**
   * RD device se generated PID XML.
   *
   * Isko DB mein store nahi karenge.
   */
  @IsString()
  @IsNotEmpty()
  pidData!: string;
}
