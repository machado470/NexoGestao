import {
  Body,
  Controller,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { OperationalStateGuard } from '../people/operational-state.guard'
import { AssessmentsService } from './assessments.service'

@Controller('assessments')
@UseGuards(JwtAuthGuard)
export class AssessmentsController {
  constructor(
    private readonly service: AssessmentsService,
  ) {}

  /**
   * 📝 SUBMISSÃO DE AVALIAÇÃO — AÇÃO HUMANA
   */
  @Post()
  @UseGuards(OperationalStateGuard)
  async submit(
    @Body()
    body: {
      assignmentId: string
      score: number
    },
  ) {
    return this.service.submit(body)
  }
}
