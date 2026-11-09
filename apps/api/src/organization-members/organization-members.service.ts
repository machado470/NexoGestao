import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateOrganizationMemberDto } from './dto/update-organization-member.dto'

@Injectable()
export class OrganizationMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async updateMember(orgId: string, actorId: string, memberId: string, input: UpdateOrganizationMemberDto) {
    if (input.role === undefined && input.active === undefined) {
      throw new BadRequestException('Informe um papel ou estado de acesso.')
    }
    return this.prisma.$transaction(async tx => {
      // Serializa alterações administrativas do tenant, inclusive entre administradores diferentes.
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "Organization" WHERE id = ${orgId} FOR UPDATE`)
      const actor = await tx.user.findFirst({ where: { id: actorId, orgId, active: true, role: 'ADMIN', person: { is: { active: true } } } })
      if (!actor) throw new ForbiddenException('Somente administradores ativos podem alterar acessos.')
      const member = await tx.user.findFirst({
        where: { id: memberId, orgId, person: { isNot: null } },
        include: { person: { select: { id: true, active: true } } },
      })
      if (!member) throw new NotFoundException('Membro não encontrado nesta organização.')
      if (member.updatedAt.getTime() !== new Date(input.expectedUpdatedAt).getTime()) {
        throw new ConflictException('O acesso foi alterado. Atualize a lista e tente novamente.')
      }
      const role = input.role ?? member.role
      const active = input.active ?? member.active
      if (role === member.role && active === member.active) {
        return { id: member.id, email: member.email, role, active, updatedAt: member.updatedAt }
      }
      if (member.id === actorId) {
        throw new BadRequestException('Peça a outro administrador para alterar seu próprio acesso.')
      }
      if (active && !member.person?.active) {
        throw new BadRequestException('A pessoa vinculada está inativa. Revise seu estado em Pessoas antes de ativar o acesso.')
      }
      if (member.role === 'ADMIN' && member.active && (role !== 'ADMIN' || !active)) {
        const otherAdmins = await tx.user.count({ where: {
          orgId, id: { not: member.id }, role: 'ADMIN', active: true, person: { is: { active: true } },
        } })
        if (otherAdmins === 0) throw new BadRequestException('A organização deve manter pelo menos um administrador ativo.')
      }
      const updated = await tx.user.update({
        where: { id: member.id }, data: { role, active },
        select: { id: true, email: true, role: true, active: true, updatedAt: true },
      })
      await tx.auditEvent.create({ data: {
        orgId, actorUserId: actorId, action: 'ORGANIZATION_MEMBER_ACCESS_UPDATED', entityType: 'USER', entityId: member.id,
        context: 'Papel ou estado de acesso do membro atualizado.',
        metadata: { previousRole: member.role, role, previouslyActive: member.active, active },
      } })
      return updated
    })
  }
}
