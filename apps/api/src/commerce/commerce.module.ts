import {ServiceCatalogController,ServiceCatalogService} from "./service-catalog";
import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
@Module({
  imports: [PrismaModule],
  controllers: [CommerceController,ServiceCatalogController],
  providers: [CommerceService,ServiceCatalogService],
})
export class CommerceModule {}
