import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { map } from 'rxjs/operators'

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((data) => {
        if (data === undefined) {
          return {
            success: true,
            data: null,
          }
        }

        return {
          success: true,
          data,
        }
      }),
    )
  }
}
