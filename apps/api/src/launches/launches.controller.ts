import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { LaunchesService } from './launches.service'
import { CreateLaunchDto, LaunchType } from './dto/create-launch.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('launches')
export class LaunchesController {
  constructor(private readonly launches: LaunchesService) {}

  @Get()
  @Roles('ADMIN')
  async list(
    @Org() orgId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: LaunchType,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.launches.list(orgId, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      type,
      from,
      to,
    })
  }

  @Get('summary')
  @Roles('ADMIN')
  async summary(@Org() orgId: string) {
    return this.launches.summary(orgId)
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateLaunchDto,
  ) {
    const userId = user?.userId ?? user?.sub ?? null
    return this.launches.create(orgId, userId, body)
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Org() orgId: string,
    @Param('id') id: string,
    @Body() body: Partial<CreateLaunchDto>,
  ) {
    return this.launches.update(orgId, id, body)
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Org() orgId: string, @Param('id') id: string) {
    return this.launches.delete(orgId, id)
  }
}
