import { AutomationTrigger } from '@prisma/client'
import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, IsEnum } from 'class-validator'

export class CreateAutomationRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsEnum(AutomationTrigger)
  trigger!: AutomationTrigger

  @IsOptional()
  @IsObject()
  conditionSet?: Record<string, any>

  @IsArray()
  actionSet!: Array<Record<string, any>>

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
