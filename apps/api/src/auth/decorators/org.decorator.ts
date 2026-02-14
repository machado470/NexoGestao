import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const Org = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest()
    return req?.user?.orgId ?? null
  },
)
