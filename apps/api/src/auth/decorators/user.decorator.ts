import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const User = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest()
    return req?.user ?? null
  },
)
