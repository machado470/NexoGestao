import { Controller, ForbiddenException, Get, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { OperationalMonitoringService } from './operational-monitoring.service'
import { OperationalIncidentsService } from './operational-incidents.service'
import { ActiveUserGuard } from '../auth/guards/active-user.guard'

@UseGuards(JwtAuthGuard, ActiveUserGuard, RolesGuard)
@Roles('ADMIN')
@Controller('internal/operations')
export class OperationsController {
  constructor(
    private readonly monitoring: OperationalMonitoringService,
    private readonly incidents: OperationalIncidentsService,
  ) {}

  @Get('summary')
  summary() { return this.platformTelemetryUnavailable() }

  @Get('incidents')
  incidentsFeed() { return this.platformTelemetryUnavailable() }

  @Get('queues')
  queues() { return this.platformTelemetryUnavailable() }

  @Get('dlq')
  dlq() { return this.platformTelemetryUnavailable() }

  @Get('recent-failures')
  recentFailures() { return this.platformTelemetryUnavailable() }

  private platformTelemetryUnavailable(): never {
    // Every current source behind these routes is process/global infrastructure
    // telemetry. There is no platform-operator authority in the current identity
    // model, so an organization ADMIN must not receive it. Keep the monitoring
    // services intact for a future, explicitly designed platform-only surface.
    void this.monitoring
    void this.incidents
    throw new ForbiddenException(
      'Telemetria global da plataforma não está disponível para usuários de organização.',
    )
  }
}
