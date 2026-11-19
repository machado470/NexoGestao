import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map } from "rxjs";
/** Keep the established strict ServiceOrder DTO stable during independent API/web deploys. */
@Injectable()
export class ServiceOrderPublicShapeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((value) => {
        if (!value || typeof value !== "object" || Array.isArray(value))
          return value;
        const { billingTreatment: _private, ...publicValue } = value;
        return publicValue;
      }),
    );
  }
}
