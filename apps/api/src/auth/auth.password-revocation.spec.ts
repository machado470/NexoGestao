import { createHash } from 'crypto'
import { UnauthorizedException } from '@nestjs/common'
import { AuthService } from './auth.service'

describe('Password reset session revocation', () => {
  const hash = createHash('sha256').update('reset-token').digest('hex')
  const subject = (count: number) => {
    const prisma = { user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user' }),
      updateMany: jest.fn().mockResolvedValue({ count }),
    } }
    return { prisma, auth: new AuthService(prisma as any, {} as any, {} as any, { get: () => undefined } as any) }
  }
  it('atomically consumes the reset token and increments the session version', async () => {
    const { prisma, auth } = subject(1)
    await auth.resetPassword('reset-token', 'new-password-123')
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'user', resetToken: hash, resetTokenExpiresAt: { gt: expect.any(Date) } },
      data: { password: expect.any(String), sessionVersion: { increment: 1 }, resetToken: null, resetTokenExpiresAt: null },
    })
  })
  it('rejects a concurrent attempt after another request consumed the reset token', async () => {
    const { auth } = subject(0)
    await expect(auth.resetPassword('reset-token', 'new-password-123')).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
