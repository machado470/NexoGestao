import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RolesGuard } from '../auth/guards/roles.guard'
import { Roles } from '../auth/decorators/roles.decorator'
import { Org } from '../auth/decorators/org.decorator'
import { User } from '../auth/decorators/user.decorator'
import { ServiceOrderAttachmentsService } from './service-order-attachments.service'

@Controller('service-orders/:serviceOrderId/attachments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ServiceOrderAttachmentsController {
  constructor(
    private readonly attachments: ServiceOrderAttachmentsService,
  ) {}

  @Get()
  @Roles('ADMIN', 'MANAGER', 'STAFF', 'VIEWER')
  list(
    @Org() orgId: string,
    @Param('serviceOrderId') serviceOrderId: string,
  ) {
    return this.attachments.listAttachments(orgId, serviceOrderId)
  }

  @Post()
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  upload(
    @Org() orgId: string,
    @Param('serviceOrderId') serviceOrderId: string,
    @User() user: any,
    @Body() body: {
      name: string
      url: string
      type?: string
      size?: number
    },
  ) {
    const personId = user?.personId ?? null
    return this.attachments.uploadAttachment({
      orgId,
      serviceOrderId,
      name: body.name,
      url: body.url,
      type: body.type,
      size: body.size,
      uploadedByPersonId: personId,
    })
  }

  @Delete(':attachmentId')
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  delete(
    @Org() orgId: string,
    @Param('serviceOrderId') serviceOrderId: string,
    @Param('attachmentId') attachmentId: string,
    @User() user: any,
  ) {
    const personId = user?.personId ?? null
    return this.attachments.deleteAttachment({
      orgId,
      serviceOrderId,
      attachmentId,
      deletedByPersonId: personId,
    })
  }
}
