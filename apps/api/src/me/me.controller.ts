import { Controller, Get, Req, UnauthorizedException, UseGuards } from '@nestjs/common'

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@Req() req: any) {
    const authUser = req.user ?? null
    const orgId = authUser?.orgId ?? null

    const user = authUser?.sub
      ? await this.prisma.user.findUnique({
          where: { id: authUser.sub },
          include: {
            person: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                active: true,
              },
            },
          },
        })
      : null

    if (user && orgId && user.orgId !== orgId) {
      throw new UnauthorizedException('Sessão inválida para esta organização')
    }

    const org = orgId
      ? await this.prisma.organization.findUnique({
          where: { id: orgId },
          select: {
            requiresOnboarding: true,
            name: true,
            slug: true,
          },
        })
      : null

    return {
      success: true,
      data: {
        user: user
          ? {
              id: user.id,
              email: user.email,
              role: user.role,
              active: user.active,
              orgId: user.orgId,
              personId: user.person?.id ?? authUser?.personId ?? null,
              person: user.person
                ? {
                    id: user.person.id,
                    name: user.person.name,
                    email: user.person.email,
                    role: user.person.role,
                    active: user.person.active,
                  }
                : null,
            }
          : {
              id: authUser?.sub ?? null,
              email: null,
              role: authUser?.role ?? null,
              active: true,
              orgId,
              personId: authUser?.personId ?? null,
              person: null,
            },
        organization: org
          ? {
              id: orgId,
              name: org.name,
              slug: org.slug,
              requiresOnboarding: org.requiresOnboarding,
            }
          : null,
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
      },
    }
  }
}
