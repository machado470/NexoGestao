import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { resolveJwtSecret } from './jwt-secret'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: resolveJwtSecret(config),
    })
  }

  async validate(payload: any) {
    if (typeof payload.sub !== 'string' || typeof payload.orgId !== 'string' ||
        !Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 0) {
      throw new UnauthorizedException('Sessão inválida. Entre novamente.')
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true, orgId: true, role: true, active: true, sessionVersion: true,
        person: { select: { id: true, active: true } },
      },
    })
    if (!user || !user.active || !user.person?.active ||
        user.orgId !== payload.orgId || user.role !== payload.role ||
        user.person.id !== payload.personId ||
        user.sessionVersion !== payload.sessionVersion) {
      throw new UnauthorizedException('Sessão revogada. Entre novamente.')
    }
    return {
      sub: user.id,
      userId: user.id,
      role: user.role,
      orgId: user.orgId,
      personId: user.person.id,
      exp: payload.exp,
    }
  }
}
