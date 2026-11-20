import { Body, CanActivate, Controller, ForbiddenException, Injectable, NotFoundException, Post, UseGuards } from '@nestjs/common'
import { WhatsAppEntityType, WhatsAppMessageType } from '@prisma/client'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { areTestEndpointsEnabled } from '../common/config/test-endpoints'
import { WhatsAppService, buildDeterministicMessageKey } from './whatsapp.service'

/**
 * Defense in depth: the controller is only registered when test endpoints are enabled
 * (see WhatsAppModule), and every request re-checks the same rule. When disabled the
 * route answers 404, before authentication, so it is indistinguishable from a missing route.
 */
@Injectable()
export class TestEndpointsEnabledGuard implements CanActivate {
  canActivate(): boolean {
    if (!areTestEndpointsEnabled()) throw new NotFoundException()
    return true
  }
}

@Controller('whatsapp/test')
@UseGuards(TestEndpointsEnabledGuard, JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class WhatsAppTestController {
  constructor(private readonly whatsapp: WhatsAppService) {}

  // Queues a real outbound message, so it is restricted to an ADMIN of the target organization.
  @Post('queue')
  async queue(@Org() orgId: string, @Body() body: any) {
    const requestedOrgId = String(body?.orgId ?? body?.organizationId ?? '').trim()
    if (requestedOrgId && requestedOrgId !== orgId) {
      throw new ForbiddenException('Payload com organização inválida para o usuário autenticado.')
    }

    const entityType = (body.entityType || 'SERVICE_ORDER') as WhatsAppEntityType
    const entityId = body.entityId || body.customerId
    const messageType = (body.messageType || 'EXECUTION_CONFIRMATION') as WhatsAppMessageType

    return this.whatsapp.queueMessage({
      orgId,
      customerId: body.customerId,
      toPhone: body.toPhone,
      entityType,
      entityId,
      messageType,
      messageKey:
        body.messageKey ||
        buildDeterministicMessageKey({
          entityType,
          entityId,
          messageType,
        }),
      renderedText: body.renderedText || body.content || 'Mensagem de teste',
    })
  }
}
