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
