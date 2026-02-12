import {
  Controller,
  Get,
  Param,
  Post,
  Body,
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
   */
  @Get()
  @Roles('ADMIN')
  async list(@Org() orgId: string) {
    return this.people.listActiveByOrg(orgId)
  }

  /**
   * 👑 ADMIN — detalhe completo da pessoa
   */
  @Get(':id')
  @Roles('ADMIN')
  async get(@Param('id') id: string) {
    return this.people.findWithContext(id)
  }

  /**
   * 👑 ADMIN — cria pessoa (ATO FUNDADOR)
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
   * 👑 ADMIN — métrica institucional
   */
  @Get('stats/linked')
  @Roles('ADMIN')
  async countLinked() {
    return {
      count: await this.people.countUsersWithPerson(),
    }
  }
}
