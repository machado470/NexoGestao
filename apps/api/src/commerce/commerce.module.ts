import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
@Module({
  imports: [PrismaModule],
  controllers: [CommerceController],
  providers: [CommerceService],
})
export class CommerceModule {}
