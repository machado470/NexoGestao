import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { AutomationService } from './automation.service'
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto'
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto'
import { ExecuteAutomationDto } from './dto/execute-automation.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('automation')
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get('rules')
  @Roles('ADMIN', 'MANAGER')
  async listRules(@Request() req: any) {
    const orgId = req.user.orgId
    const data = await this.automation.listRules(orgId)
    return { ok: true, data }
  }

  @Post('rules')
  @Roles('ADMIN', 'MANAGER')
  async createRule(@Request() req: any, @Body() body: CreateAutomationRuleDto) {
    const orgId = req.user.orgId
    const actorUserId = req.user.userId ?? req.user.sub ?? null
    const data = await this.automation.createRule(orgId, actorUserId, body)
    return { ok: true, data }
  }

  @Patch('rules/:id')
  @Roles('ADMIN', 'MANAGER')
  async updateRule(@Request() req: any, @Param('id') id: string, @Body() body: UpdateAutomationRuleDto) {
    const orgId = req.user.orgId
    const data = await this.automation.updateRule(orgId, id, body)
    return { ok: true, data }
  }

  @Post('execute')
  @Roles('ADMIN', 'MANAGER')
  async execute(@Request() req: any, @Body() body: ExecuteAutomationDto) {
    const orgId = req.user.orgId
    const data = await this.automation.executeTrigger({
      orgId,
      trigger: body.trigger,
      payload: body.payload,
    })
    return { ok: true, data }
  }
}
