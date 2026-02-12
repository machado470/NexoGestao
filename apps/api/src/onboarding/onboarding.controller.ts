import {
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PrismaService } from '../prisma/prisma.service'

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('complete')
  async complete(@Req() req: any) {
    const orgId = req.user.orgId

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        requiresOnboarding: false,
      },
    })

    return { success: true }
  }
}
