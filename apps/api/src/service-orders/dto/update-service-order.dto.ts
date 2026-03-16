import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

const SERVICE_ORDER_STATUSES = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'DONE',
  'CANCELED',
] as const

export class UpdateServiceOrderDto {
  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string

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
  @IsIn(SERVICE_ORDER_STATUSES as unknown as string[])
  status?: (typeof SERVICE_ORDER_STATUSES)[number]

  // Pode ser null para desatribuir.
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string')
  @IsString()
  assignedToPersonId?: string | null

  // Valor opcional para cobrança vinculada à O.S.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amountCents?: number

  // Vencimento opcional.
  // Se vier string vazia, o service pode limpar.
  // Se houver amountCents e dueDate continuar ausente,
  // o service aplica vencimento padrão de +3 dias.
  @IsOptional()
  @IsString()
  dueDate?: string

  @IsOptional()
  @IsString()
  @MaxLength(400)
  cancellationReason?: string

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outcomeSummary?: string
}
