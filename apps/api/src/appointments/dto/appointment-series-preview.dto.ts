import { IsIn, IsInt, IsISO8601, IsOptional, IsUUID, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator'

export class AppointmentSeriesPreviewDto {
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  startsAt!: string

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  endsAt?: string

  @IsOptional()
  @IsUUID()
  assignedToPersonId?: string

  @IsIn(['WEEKLY', 'BIWEEKLY'])
  cadence!: 'WEEKLY' | 'BIWEEKLY'

  @IsInt()
  @Min(2)
  @Max(12)
  count!: number
}

export class CreateAppointmentSeriesDto extends AppointmentSeriesPreviewDto {
  @IsUUID()
  customerId!: string

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  entryKey!: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string
}

export class RescheduleAppointmentSeriesDto {
  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  startsAt!: string

  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  endsAt!: string

  @IsISO8601({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/i)
  expectedUpdatedAt!: string
}
