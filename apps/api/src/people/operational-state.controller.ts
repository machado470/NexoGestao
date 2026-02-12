import {
  Controller,
  Post,
  Param,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'

/**
 * ⚠️ ENDPOINT ADMINISTRATIVO / DEV
 *
 * Este controller existe APENAS para:
 * - ambiente de desenvolvimento
 * - ambiente de demonstração
 * - suporte operacional controlado
 *
 * Ele NÃO substitui o motor de risco.
 * Ele REMOVE CAUSAS que mantêm o estado RESTRICTED.
 */

@Controller('admin/operational-state')
@UseGuards(JwtAuthGuard)
export class OperationalStateController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 🔓 Override consciente de estado operacional
   * Fecha ações corretivas abertas e zera risco operacional
   */
  @Post(':personId/force-normal')
  async forceNormal(
    @Param('personId') personId: string,
  ) {
    // 1️⃣ Fechar ações corretivas abertas
    await this.prisma.correctiveAction.updateMany({
      where: {
        personId,
        status: 'OPEN',
      },
      data: {
        status: 'DONE',
        resolvedAt: new Date(),
      },
    })

    // 2️⃣ Zerar risco operacional
    await this.prisma.person.update({
      where: { id: personId },
      data: { riskScore: 0 },
    })

    // 3️⃣ Auditoria explícita
    await this.audit.log({
      personId,
      action: 'ADMIN_FORCE_OPERATIONAL_STATE_NORMAL',
      context:
        'Override administrativo consciente para DEV/DEMO',
    })

    return {
      success: true,
      message:
        'Estado operacional liberado por override administrativo',
    }
  }
}
