import {ServiceQuotesController,PublicQuoteApprovalController,ServiceQuotesService} from "./service-quotes";
import {ServiceCatalogController,ServiceCatalogService} from "./service-catalog";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
@Module({
  imports: [PrismaModule],
  controllers: [ServiceQuotesController,PublicQuoteApprovalController,CommerceController,ServiceCatalogController],
  providers: [ServiceQuotesService,CommerceService,ServiceCatalogService],
})
export class CommerceModule {}
