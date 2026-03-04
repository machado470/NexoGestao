import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { ClsService } from 'nestjs-cls'

@Injectable()
export class OrgContextInterceptor implements NestInterceptor {
  constructor(private readonly cls: ClsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest()
    const user = request.user

    if (user && user.orgId) {
      this.cls.set('orgId', user.orgId)
      this.cls.set('userId', user.sub || user.userId)
      this.cls.set('personId', user.personId)
    }

    return next.handle()
  }
}
