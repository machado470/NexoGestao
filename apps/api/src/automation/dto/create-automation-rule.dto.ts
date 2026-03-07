import { IsArray, IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator'

export class CreateAutomationRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsOptional()
  @IsString()
  description?: string

  @IsString()
  @IsNotEmpty()
  trigger!: string

  @IsOptional()
  @IsObject()
  conditionSet?: Record<string, any>

  @IsArray()
  actionSet!: Array<Record<string, any>>

  @IsOptional()
  @IsBoolean()
  active?: boolean
}
