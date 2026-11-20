import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RiskSnapshotService } from '../risk/risk-snapshot.service'

@Controller('persons')
@UseGuards(JwtAuthGuard)
export class PersonsRiskHistoryController {
  constructor(
    private readonly snapshots: RiskSnapshotService,
  ) {}

  @Get(':id/risk-history')
  async history(
    @Req() req: any,
    @Param('id') personId: string,
  ) {
    return this.snapshots.listByPerson(personId, req.user.orgId)
  }
}
