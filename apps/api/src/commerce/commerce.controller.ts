import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { Org } from "../auth/decorators/org.decorator";
import { User } from "../auth/decorators/user.decorator";
import { CommerceService } from "./commerce.service";
import {
  ProductDto,
  MovementDto,
  FiscalDraftDto,
  RecordedExpenseDto,
  ExpenseCurrencyDto,
} from "./commerce.dto";
@Controller("commerce")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("ADMIN")
export class CommerceController {
  constructor(private readonly service: CommerceService) {}
  private actor(user: any) {
    const id = user?.userId ?? user?.sub;
    if (!id) throw new UnauthorizedException();
    return String(id);
  }
  @Get("products") products(
    @Org() org: string,
    @Query("page") page?: string,
    @Query("q") q?: string,
  ) {
    return this.service.products(org, page ? Number(page) : 1, q);
  }
  @Post("products") createProduct(
    @Org() org: string,
    @Body() body: ProductDto,
  ) {
    return this.service.createProduct(org, body);
  }
  @Get("movements") movements(@Org() org: string) {
    return this.service.movements(org);
  }
  @Post("movements") move(
    @Org() org: string,
    @User() user: any,
    @Body() body: MovementDto,
  ) {
    return this.service.move(org, this.actor(user), body);
  }
  @Get("fiscal-drafts") fiscalDrafts(@Org() org: string) {
    return this.service.fiscalDrafts(org);
  }
  @Post("fiscal-drafts") createDraft(
    @Org() org: string,
    @User() user: any,
    @Body() body: FiscalDraftDto,
  ) {
    return this.service.createFiscalDraft(org, this.actor(user), body);
  }
  @Get("health") health(@Org() org: string, @Query("month") month?: string) {
    return this.service.health(org, month);
  }
  @Post("expenses/currency") classify(
    @Org() org: string,
    @Body() body: ExpenseCurrencyDto,
  ) {
    return this.service.classifyExpenseCurrency(org, body.id, body.currency);
  }
  @Post("expenses") expense(
    @Org() org: string,
    @User() user: any,
    @Body() body: RecordedExpenseDto,
  ) {
    return this.service.recordExpense(org, this.actor(user), body);
  }
}
