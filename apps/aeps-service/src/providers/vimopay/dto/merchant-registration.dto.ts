import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class VimopayMerchantRegistrationDto {
  @IsString()
  @IsNotEmpty()
  merchantRefId!: string;

  @IsString()
  @IsNotEmpty()
  ipAddress!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  lat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  long!: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @Matches(/^\d{2}-\d{2}-\d{4}$/)
  dob!: string;

  @IsString()
  @Matches(/^\d+$/)
  merchantPhoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  merchantAddress1!: string;

  @IsOptional()
  @IsString()
  merchantAddress2?: string;

  @IsString()
  @IsNotEmpty()
  merchantState!: string;

  @IsString()
  @IsNotEmpty()
  merchantDistrict!: string;

  @IsString()
  @IsIn(['M', 'F', 'O'])
  gender!: 'M' | 'F' | 'O';

  @IsString()
  @Matches(/^\d+$/)
  merchantPinCode!: string;

  @IsEmail()
  emailId!: string;

  @IsString()
  @IsNotEmpty()
  merchantPan!: string;

  @IsString()
  @Matches(/^\d+$/)
  aadhaarNumber!: string;

  @IsString()
  @IsNotEmpty()
  shopPan!: string;

  @IsString()
  @Matches(/^\d+$/)
  bankAccountNumber!: string;

  @IsString()
  @IsNotEmpty()
  bankIfscCode!: string;

  /**
   * IMPORTANT:
   * Ye bank ka naam nahi hai.
   * Bank List API se mila code pass karna hai.
   */
  @IsString()
  @Matches(/^\d+$/, {
    message: 'bankName must be a bank code from Bank List API',
  })
  bankName!: string;

  @IsString()
  @IsIn([
    'Savings account',
    'Current account',
    'Savings Account',
    'Current Account',
  ])
  accountType!: string;

  @IsString()
  @IsNotEmpty()
  shopAddress!: string;

  @IsString()
  @IsNotEmpty()
  shopDistrict!: string;

  @IsString()
  @IsNotEmpty()
  shopState!: string;

  /**
   * PDF sample request isi spelling ko use karta hai:
   * shopPincode
   */
  @IsString()
  @Matches(/^\d+$/)
  shopPincode!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  shopLat!: string;

  @IsString()
  @Matches(/^-?\d+(\.\d+)?$/)
  shopLong!: string;
}
