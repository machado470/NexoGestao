import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { ClsService } from 'nestjs-cls'
import { Reflector } from '@nestjs/core'
import { IS_PUBLIC_KEY } from './decorators/public.decorator'

@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const user = request.user
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    this.cls.set('isHttpRequest', true)
    this.cls.set('allowWithoutOrg', Boolean(isPublic))

    const requestId = (request as any).requestId ?? request.headers['x-request-id'] ?? null
    const correlationId =
      (request as any).correlationId ?? request.headers['x-correlation-id'] ?? requestId
    this.cls.set('requestId', requestId)
    this.cls.set('correlationId', correlationId)

    if (user && user.orgId) {
      this.cls.set('orgId', user.orgId)
      this.cls.set('userId', user.sub || user.userId)
      this.cls.set('personId', user.personId)
    }

    return next.handle()
  }
}
