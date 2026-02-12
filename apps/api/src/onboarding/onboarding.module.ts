import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { OnboardingController } from './onboarding.controller'

@Module({
  imports: [PrismaModule],
  controllers: [OnboardingController],
})
export class OnboardingModule {}
