import {
  IsNotEmpty,
  IsInt,
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
  Min,
  Max,
  MaxLength,
} from 'class-validator'

export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  ISSUED = 'ISSUED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export class CreateInvoiceDto {
  @IsUUID()
  @IsOptional()
  customerId?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  number!: string

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  amountCents!: number

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus
}
