import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export type AuthUser = {
  userId: string
  role: 'ADMIN' | 'COLLABORATOR'
  orgId: string
  personId?: string | null
}

export const User = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser | null => {
    const request = ctx.switchToHttp().getRequest()
    return request?.user ?? null
  },
)
