import { Transform } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator'

const ALLOWED_STATUSES = ['PENDING', 'OVERDUE', 'PAID', 'CANCELED'] as const
const ALLOWED_ORDER_BY = ['createdAt', 'dueDate', 'amountCents'] as const
const ALLOWED_DIRECTION = ['asc', 'desc'] as const

export class ChargesQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(ALLOWED_STATUSES as unknown as string[])
  status?: (typeof ALLOWED_STATUSES)[number]

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined
    const n = Number(value)
    return Number.isFinite(n) ? n : value
  })
  @IsNumber()
  limit?: number

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  q?: string

  // Cursor de paginação (vamos usar o ID do último item da página anterior)
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  cursor?: string

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(ALLOWED_ORDER_BY as unknown as string[])
  orderBy?: (typeof ALLOWED_ORDER_BY)[number]

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsIn(ALLOWED_DIRECTION as unknown as string[])
  direction?: (typeof ALLOWED_DIRECTION)[number]
}
