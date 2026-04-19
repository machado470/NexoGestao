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
import { ExpensesService } from './expenses.service'
import { CreateExpenseDto } from './dto/create-expense.dto'
import { ExpensesQueryDto } from './dto/expenses-query.dto'

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @Roles('ADMIN')
  async list(@Org() orgId: string, @Query() query: ExpensesQueryDto) {
    return this.expenses.list(orgId, query)
  }

  @Get('summary')
  @Roles('ADMIN')
  async summary(@Org() orgId: string, @Query('month') month?: string) {
    return this.expenses.summary(orgId, month)
  }

  @Get('monthly-result')
  @Roles('ADMIN')
  async monthlyResult(@Org() orgId: string, @Query('month') month?: string) {
    return this.expenses.getMonthlyFinancialResult(orgId, month)
  }

  @Post()
  @Roles('ADMIN')
  async create(
    @Org() orgId: string,
    @User() user: any,
    @Body() body: CreateExpenseDto,
  ) {
    const userId = user?.userId ?? user?.sub ?? null
    return this.expenses.create(orgId, userId, body)
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(
    @Org() orgId: string,
    @User() user: any,
    @Param('id') id: string,
    @Body() body: Partial<CreateExpenseDto>,
  ) {
    const userId = user?.userId ?? user?.sub ?? null
    return this.expenses.update(orgId, id, userId, body)
  }

  @Delete(':id')
  @Roles('ADMIN')
  async delete(@Org() orgId: string, @User() user: any, @Param('id') id: string) {
    const userId = user?.userId ?? user?.sub ?? null
    return this.expenses.delete(orgId, id, userId)
  }
}
