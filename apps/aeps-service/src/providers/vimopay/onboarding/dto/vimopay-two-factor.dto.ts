import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class VimopayTwoFactorDto {
  /*
   * Actual Aadhaar = exactly 12 digits.
   * DB mein save nahi hoga.
   */
  @IsString()
  @Matches(/^\d{12}$/, {
    message: 'aadhaarNumber must be exactly 12 digits',
  })
  aadhaarNumber!: string;

  /*
   * Example:
   * mantra
   * aadhaarfacerd
   *
   * Hard-coded enum nahi kar rahe because
   * future RD devices ho sakte hain.
   */
  @IsString()
  @IsNotEmpty()
  deviceType!: string;

  /*
   * Fresh RD-device PID XML.
   * DB mein save nahi hoga.
   */
  @IsString()
  @IsNotEmpty()
  pidData!: string;

  /*
   * Current merchant location.
   * Frontend GPS se aayegi.
   */
  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;
}
