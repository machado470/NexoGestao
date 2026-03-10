import {
  Controller,
  Get,
  Req,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('me')
export class MeController {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async me(@Req() req: any) {
    const user = req.user ?? null
    const orgId = user?.orgId ?? null

    const org = orgId
      ? await this.prisma.organization.findUnique({
          where: { id: orgId },
          select: { requiresOnboarding: true },
        })
      : null

    return {
      user,
      operational: {
        state: 'NORMAL',
        severity: 'success',
        message: 'Tudo certo. Nenhuma ação necessária.',
        riskScore: 0,
      },
      pending: {
        count: 0,
        items: [],
      },
      assignments: [],
      requiresOnboarding: org?.requiresOnboarding ?? false,
      redirect: org?.requiresOnboarding ? '/onboarding' : '/dashboard',
    }
  }
}
