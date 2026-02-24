import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MaxLength,
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

  // pode ser null (desatribuir). class-validator não valida null por padrão,
  // então usamos ValidateIf pra validar apenas quando for string.
  @IsOptional()
  @ValidateIf((_, v) => typeof v === 'string')
  @IsString()
  assignedToPersonId?: string | null

  // 💰 Finance (MVP): valor da cobrança ao concluir a O.S.
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  amountCents?: number

  // 💰 Finance (MVP): vencimento da cobrança (ISO string).
  // Se não vier e a cobrança for criada, usamos default +3 dias.
  @IsOptional()
  @IsString()
  dueDate?: string
}
