import {QuoteOrderController,QuoteOrderService} from "./quote-order";
import {QuotasModule} from "../quotas/quotas.module";
import {ServiceQuotesController,PublicQuoteApprovalController,ServiceQuotesService} from "./service-quotes";
import {ServiceCatalogController,ServiceCatalogService} from "./service-catalog";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
@Module({
  imports: [PrismaModule,QuotasModule],
  controllers: [QuoteOrderController,ServiceQuotesController,PublicQuoteApprovalController,CommerceController,ServiceCatalogController],
  providers: [QuoteOrderService,ServiceQuotesService,CommerceService,ServiceCatalogService],
})
export class CommerceModule {}
