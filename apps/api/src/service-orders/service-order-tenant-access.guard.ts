import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class ServiceOrderTenantAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<any>()
    const id = request?.params?.id
    const orgId = request?.user?.orgId

    if (!id || !orgId) return true

    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: { id, orgId },
      select: { id: true },
    })

    if (!serviceOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada')
    }

    return true
  }
}
