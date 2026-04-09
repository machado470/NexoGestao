import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator'

// Enums alinhados com o schema Prisma: AppointmentStatus
const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'CANCELED',
  'DONE',
  'NO_SHOW',
] as const

export class UpdateAppointmentDto {
  @IsOptional()
  @IsString()
  startsAt?: string

  @IsOptional()
  @IsString()
  endsAt?: string

  @IsOptional()
  @IsIn(APPOINTMENT_STATUSES as unknown as string[])
  status?: (typeof APPOINTMENT_STATUSES)[number]

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string

  @IsOptional()
  @IsString()
  expectedUpdatedAt?: string
}
