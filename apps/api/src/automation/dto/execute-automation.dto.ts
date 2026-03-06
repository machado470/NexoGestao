import { AutomationTrigger } from '@prisma/client'
import { IsEnum, IsObject } from 'class-validator'

export class ExecuteAutomationDto {
  @IsEnum(AutomationTrigger)
  trigger!: AutomationTrigger

  @IsObject()
  payload!: Record<string, any>
}
