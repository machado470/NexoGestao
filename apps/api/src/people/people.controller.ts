import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import { PeopleService } from './people.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { PeopleOperationalSummaryService } from './people-operational-summary.service'
import { PersonAvailabilityExceptionsService } from './person-availability-exceptions.service'

type CreatePersonDTO = {
  name: string
  role: string
  email?: string
}

@Controller('people')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PeopleController {
  constructor(
    private readonly people: PeopleService,
    private readonly operationalSummary: PeopleOperationalSummaryService,
    private readonly availabilityExceptions: PersonAvailabilityExceptionsService,
  ) {}

  /**
   * 👑 ADMIN — lista pessoas ativas da organização
   * GET /people
   */
  @Get()
  @Roles('ADMIN')
  async list(@Org() orgId: string) {
    return this.people.listActiveByOrg(orgId)
  }


  /**
   * Leitura operacional tenant-scoped de responsáveis para telas com appointments:read.
   * Não expõe orgId do client e mantém o CRUD completo de /people restrito a ADMIN.
   * GET /people/assignees
   */
  @Get('assignees')
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  async listAssignees(@Org() orgId: string) {
    return this.people.listActiveByOrg(orgId)
  }

  /**
   * 👑 ADMIN — métrica institucional
   * GET /people/stats/linked
   * IMPORTANTE: rota estática deve vir ANTES de :id para não ser capturada como parâmetro dinâmico.
   */
  @Get('stats/linked')
  @Roles('ADMIN')
  async countLinked() {
    return {
      count: await this.people.countUsersWithPerson(),
    }
  }

  /**
   * 👑 ADMIN — resumo operacional real da equipe autenticada
   * GET /people/operational-summary
   */
  @Get('operational-summary')
  @Roles('ADMIN')
  async getOperationalSummary(@Org() orgId: string) {
    return this.operationalSummary.getSummary(orgId)
  }

  /** 👑 ADMIN — lista indisponibilidades temporárias tenant-scoped. */
  @Get(':personId/availability-exceptions')
  @Roles('ADMIN')
  async listAvailabilityExceptions(@Param('personId') personId: string, @Org() orgId: string) {
    return this.availabilityExceptions.list(personId, orgId)
  }

  /** 👑 ADMIN — cria indisponibilidade temporária tenant-scoped. */
  @Post(':personId/availability-exceptions')
  @Roles('ADMIN')
  async createAvailabilityException(
    @Param('personId') personId: string,
    @Org() orgId: string,
    @Body() body: { startsAt: string; endsAt: string; reason?: string | null },
  ) {
    return this.availabilityExceptions.create(personId, orgId, body)
  }

  /** 👑 ADMIN — remove indisponibilidade temporária tenant-scoped. */
  @Delete(':personId/availability-exceptions/:exceptionId')
  @Roles('ADMIN')
  async deleteAvailabilityException(
    @Param('personId') personId: string,
    @Param('exceptionId') exceptionId: string,
    @Org() orgId: string,
  ) {
    return this.availabilityExceptions.delete(personId, exceptionId, orgId)
  }

  /**
   * 👑 ADMIN — detalhe completo da pessoa
   * GET /people/:id
   */
  @Get(':id')
  @Roles('ADMIN')
  async get(@Param('id') id: string, @Org() orgId: string) {
    return this.people.findWithContext(id, orgId)
  }

  /**
   * 👑 ADMIN — cria pessoa (ATO FUNDADOR)
   * POST /people
   */
  @Post()
  @Roles('ADMIN')
  async create(
    @Body() body: CreatePersonDTO,
    @Org() orgId: string,
    @User() user: any,
  ) {
    return this.people.createPerson({
      name: body.name,
      role: body.role,
      email: body.email,
      orgId,
      createdBy: user.userId,
    })
  }

  /**
   * 👑 ADMIN — atualiza pessoa
   * PATCH /people/:id
   */
  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Param('id') id: string,
    @Org() orgId: string,
    @Body() body: any,
  ) {
    return this.people.updatePerson(id, orgId, body)
  }

  /**
   * 👑 ADMIN — desativa pessoa (soft delete)
   * DELETE /people/:id
   * Não remove do banco; apenas marca active = false e gera audit + timeline.
   * Regra: pessoa com OS ativa não pode ser desativada.
   */
  @Delete(':id')
  @Roles('ADMIN')
  async deactivate(
    @Param('id') id: string,
    @Org() orgId: string,
    @User() user: any,
  ) {
    return this.people.deactivatePerson(id, orgId, user?.userId ?? null)
  }
}
