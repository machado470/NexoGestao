import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class BootstrapService {
  constructor(private readonly prisma: PrismaService) {}

  private slugify(input: string) {
    const s = (input ?? '').trim().toLowerCase()
    const normalized = s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')

    return normalized || 'org'
  }

  private async uniqueOrgSlug(base: string) {
    let slug = base
    let i = 0

    while (true) {
      const exists = await this.prisma.organization.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!exists) return slug

      i++
      slug = `${base}-${i}`
    }
  }

  async createFirstAdmin(params: {
    orgName: string
    adminName: string
    email: string
    password: string
  }) {
    const orgName = (params.orgName ?? '').trim()
    const adminName = (params.adminName ?? '').trim()
    const email = (params.email ?? '').trim().toLowerCase()
    const password = params.password ?? ''

    if (!orgName) throw new BadRequestException('orgName obrigatório')
    if (!adminName) throw new BadRequestException('adminName obrigatório')
    if (!email) throw new BadRequestException('email obrigatório')
    if (!password || password.length < 4) {
      throw new BadRequestException('password inválida')
    }

    const existingAdmin = await this.prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    })

    if (existingAdmin) {
      throw new ConflictException('Bootstrap já realizado (ADMIN existente)')
    }

    const emailInUse = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (emailInUse) {
      throw new ConflictException('Email já cadastrado')
    }

    const baseSlug = this.slugify(orgName)
    const slug = await this.uniqueOrgSlug(baseSlug)

    const passwordHash = await bcrypt.hash(password, 10)

    const created = await this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: {
          name: orgName,
          slug,
          requiresOnboarding: false,
        },
      })

      const user = await tx.user.create({
        data: {
          email,
          password: passwordHash,
          role: 'ADMIN',
          active: true,
          orgId: org.id,
        },
      })

      const person = await tx.person.create({
        data: {
          name: adminName,
          email,
          role: 'ADMIN',
          active: true,
          orgId: org.id,
          userId: user.id,
        },
      })

      return { org, user, person }
    })

    return {
      success: true,
      orgId: created.org.id,
      userId: created.user.id,
      personId: created.person.id,
    }
  }
}
