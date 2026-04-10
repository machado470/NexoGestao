import { Module } from '@nestjs/common'
import { CommercialController, AdminCommercialController } from './commercial.controller'

@Module({
  controllers: [CommercialController, AdminCommercialController],
})
export class CommercialModule {}
