import { ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsInt, IsIn, IsUUID, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

export class ListCustomersQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 10_000, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  page?: number

  @ApiPropertyOptional({ minimum: 1, maximum: 500, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string

  @IsOptional()
  @IsIn(['active', 'inactive'])
  active?: 'active' | 'inactive'

  @IsOptional()
  @IsUUID()
  focusId?: string

  @IsOptional()
  @IsIn(['P0', 'P1', 'P2', 'P3'])
  priority?: string

  @IsOptional()
  @IsIn(['NORMAL', 'WARNING', 'RESTRICTED', 'SUSPENDED'])
  riskState?: string
}
