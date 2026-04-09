import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'

export class CreateServiceOrderDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(140)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  priority?: number

  @IsOptional()
  @IsString()
  scheduledFor?: string

  @IsOptional()
  @IsString()
  appointmentId?: string

  @IsOptional()
  @IsString()
  assignedToPersonId?: string

  // Valor opcional da O.S. para geração de cobrança posterior.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amountCents?: number

  // Vencimento opcional.
  // Quando amountCents existir e dueDate não vier,
  // o service define vencimento padrão de +3 dias.
  @IsOptional()
  @IsString()
  dueDate?: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  idempotencyKey?: string
}
