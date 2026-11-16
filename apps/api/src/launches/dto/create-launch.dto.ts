import {
  IsNotEmpty,
  Matches,
  IsInt,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  Min,
  Max,
  MaxLength,
} from 'class-validator'

export enum LaunchType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  TRANSFER = 'TRANSFER',
}

export class CreateLaunchDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: "O texto deve conter caracteres além de espaços" })
  @MaxLength(255)
  description!: string

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  amountCents!: number

  @IsEnum(LaunchType)
  type!: LaunchType

  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: "O texto deve conter caracteres além de espaços" })
  @MaxLength(100)
  category!: string

  @IsString()
  @IsOptional()
  @MaxLength(100)
  account?: string

  @IsDateString()
  @IsNotEmpty()
  date!: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string
}
