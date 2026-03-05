import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcrypt'

import { PrismaService } from '../prisma/prisma.service'



@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,


  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { person: true },
    })

    if (!user || !user.password) {
      throw new UnauthorizedException('Usuário inválido')
    }

    if (!user.active) {
      throw new UnauthorizedException('Conta não ativada')
    }

    if (!user.person) {
      throw new UnauthorizedException(
        'Usuário sem identidade operacional',
      )
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      throw new UnauthorizedException('Senha inválida')
    }

    const token = this.jwt.sign({
      sub: user.id,
      role: user.role,
      orgId: user.orgId,
      personId: user.person.id,
    })

    return {
      token,
      user: {
        id: user.id,
        role: user.role,
        orgId: user.orgId,
        personId: user.person.id,
      },
    }
  }


}
