import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsUUID,
  Min,
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

  @IsNumber()
  @Min(1)
  amountCents!: number

  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus

  @IsDateString()
  @IsOptional()
  dueDate?: string

  @IsDateString()
  @IsOptional()
  issuedAt?: string

  @IsDateString()
  @IsOptional()
  paidAt?: string

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  notes?: string
}
