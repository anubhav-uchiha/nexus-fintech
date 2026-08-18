import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsObject,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export class OnboardEkoUserDto {
  /**
   * Unique retailer/agent code.
   * EKO: registered mobile number of the agent/retailer.
   */
  // @IsString()
  // @IsNotEmpty()
  // @Matches(/^[6-9]\d{9}$/, {
  //   message: 'user_code must be a valid 10-digit Indian mobile number',
  // })
  // user_code!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, {
    message: 'pan_number must be a valid PAN number',
  })
  pan_number!: string;

  /**
   * Verified mobile number of the agent.
   */
  @IsString()
  @IsNotEmpty()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'mobile must be a valid 10-digit Indian mobile number',
  })
  mobile!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  first_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  last_name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  residence_address!: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(255)
  email!: string;

  /**
   * Required for AePS onboarding.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  shop_name!: string;

  /**
   * YYYY-MM-DD
   */
  @IsDateString(
    {},
    {
      message: 'dob must be a valid date in YYYY-MM-DD format',
    },
  )
  dob!: string;
}
