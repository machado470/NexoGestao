import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { RiskService } from '../risk/risk.service'
import { AuditService } from '../audit/audit.service'
import { CorrectiveActionsService } from '../corrective-actions/corrective-actions.service'
import { TimelineService } from '../timeline/timeline.service'

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

const ASSESSMENT_CRITICAL_REASON = 'Risco crítico identificado em avaliação'

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly risk: RiskService,
    private readonly audit: AuditService,
    private readonly corrective: CorrectiveActionsService,
    private readonly timeline: TimelineService,
  ) {}

  async submit(params: { assignmentId: string; score: number }) {
    if (!params.assignmentId?.trim()) {
      throw new BadRequestException('assignmentId é obrigatório')
    }

    if (!Number.isFinite(params.score)) {
      throw new BadRequestException('score inválido')
    }

    if (params.score < 0 || params.score > 100) {
      throw new BadRequestException('score deve estar entre 0 e 100')
    }

    const assignment = await this.prisma.assignment.findUnique({
      where: { id: params.assignmentId },
      include: {
        person: true,
        track: true,
      },
    })

    if (!assignment) {
      throw new NotFoundException('Assignment não encontrado')
    }

    // ✅ Regra de domínio: só pode avaliar se trilha foi concluída
    if (assignment.progress < 100) {
      throw new BadRequestException(
        'Não é possível submeter avaliação: trilha ainda não concluída',
      )
    }

    // ----------------------------
    // 1️⃣ RISCO EDUCACIONAL (por score)
    // ----------------------------
    const assessmentRisk: RiskLevel =
      params.score >= 80
        ? 'LOW'
        : params.score >= 60
          ? 'MEDIUM'
          : params.score >= 40
            ? 'HIGH'
            : 'CRITICAL'

    // ----------------------------
    // 2️⃣ CRIAR ASSESSMENT
    // ----------------------------
    const assessment = await this.prisma.assessment.create({
      data: {
        score: params.score,
        risk: assessmentRisk,
        assignmentId: assignment.id,
        personId: assignment.personId,
        trackId: assignment.trackId,
      },
    })

    // ----------------------------
    // 3️⃣ Atualizar risco do assignment (progress é derivado)
    // ----------------------------
    await this.prisma.assignment.update({
      where: { id: assignment.id },
      data: { risk: assessmentRisk },
    })

    // ----------------------------
    // 4️⃣ AÇÃO CORRETIVA (SE CRÍTICO) — idempotência básica
    // - se já existe OPEN recente com a mesma razão, não cria outra
    // ----------------------------
    if (assessmentRisk === 'CRITICAL') {
      const windowMs = 1000 * 60 * 60 * 24 // 24h
      const since = new Date(Date.now() - windowMs)

      const existingOpen = await this.prisma.correctiveAction.findFirst({
        where: {
          personId: assignment.personId,
          status: 'OPEN',
          reason: ASSESSMENT_CRITICAL_REASON,
          createdAt: { gte: since },
        },
        select: { id: true },
      })

      if (!existingOpen) {
        const created = await this.prisma.correctiveAction.create({
          data: {
            personId: assignment.personId,
            reason: ASSESSMENT_CRITICAL_REASON,
            status: 'OPEN',
          },
        })

        await this.audit.log({
          action: 'CORRECTIVE_ACTION_CREATED',
          personId: assignment.personId,
          context: 'Ação corretiva criada automaticamente após avaliação crítica',
        })

        await this.timeline.log({
          action: 'CORRECTIVE_ACTION_CREATED',
          personId: assignment.personId,
          description: created.reason,
          metadata: {
            correctiveActionId: created.id,
            source: 'ASSESSMENT',
            assignmentId: assignment.id,
            trackId: assignment.trackId,
            score: params.score,
            risk: assessmentRisk,
          },
        })
      } else {
        // opcional: só registra auditoria explicando o “não criar duplicado”
        await this.audit.log({
          action: 'CORRECTIVE_ACTION_SKIPPED_DUPLICATE',
          personId: assignment.personId,
          context: `Corretiva OPEN já existe (id=${existingOpen.id}) para avaliação crítica recente`,
        })
      }
    }

    // ----------------------------
    // 5️⃣ RISCO OPERACIONAL (agregado) — depois da corretiva existir
    // (RiskService agora é dono do snapshot + timeline do snapshot)
    // ----------------------------
    const operationalScore = await this.risk.recalculatePersonRisk(
      assignment.personId,
      `Avaliação concluída (${params.score} pontos)`,
    )

    // ----------------------------
    // 6️⃣ AUDITORIA (assessment)
    // ----------------------------
    await this.audit.log({
      action: 'ASSESSMENT_SUBMITTED',
      personId: assignment.personId,
      context: `Avaliação da trilha "${assignment.track.title}" concluída com score ${params.score}`,
    })

    // mantém a injeção viva (caso queira usar depois sem “unused” em setups chatos)
    void this.corrective
    void operationalScore

    return assessment
  }
}
