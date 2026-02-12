import { Controller, Post, Param } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('persons/:id/reminder')
export class PersonsReminderController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  async remind(@Param('id') personId: string) {
    await this.prisma.timelineEvent.create({
      data: {
        personId,
        action: 'REMINDER_SENT',
        description: 'Lembrete manual enviado',
      },
    })

    return { success: true }
  }
}
