import { IsArray, IsBoolean, IsObject, IsOptional, IsString } from 'class-validator'

export class UpdateAutomationRuleDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  description?: string

  @IsOptional()
  @IsString()
  trigger?: string

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
