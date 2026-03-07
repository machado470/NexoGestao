import { IsObject, IsOptional, IsString } from 'class-validator'

export class ExecuteAutomationDto {
  @IsString()
  ruleId!: string

  @IsString()
  trigger!: string

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>
}
