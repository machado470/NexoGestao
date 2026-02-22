import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, MaxLength } from 'class-validator'

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
}
