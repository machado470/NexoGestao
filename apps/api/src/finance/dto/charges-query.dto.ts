import { Transform } from 'class-transformer'
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator'

const ALLOWED_STATUSES = ['PENDING', 'OVERDUE', 'PAID'] as const

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
}
