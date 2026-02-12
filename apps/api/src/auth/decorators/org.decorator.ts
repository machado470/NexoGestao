import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const Org = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()

    return request?.user?.orgId ?? null
  },
)
