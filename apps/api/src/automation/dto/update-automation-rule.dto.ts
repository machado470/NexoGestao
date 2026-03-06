import { AutomationTrigger } from '@prisma/client'
import { IsArray, IsBoolean, IsEnum, IsObject, IsOptional, IsString } from 'class-validator'

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsEnum(AutomationTrigger)
  trigger?: AutomationTrigger

  @IsOptional()
  @IsObject()
  conditionSet?: Record<string, any>

  @IsOptional()
  @IsArray()
  actionSet?: Array<Record<string, any>>

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
