import { Transform } from 'class-transformer'
import { IsBoolean, IsDateString, IsEnum, IsOptional } from 'class-validator'
import { InviteUserRole } from '../../invites/dto/create-invite.dto'

export class UpdateOrganizationMemberDto {
  @IsOptional()
  @IsEnum(InviteUserRole)
  role?: InviteUserRole

  @IsOptional()
  // Preserva o tipo recebido mesmo com enableImplicitConversion no bootstrap.
  @Transform(({ obj, key }) => obj[key])
  @IsBoolean()
  active?: boolean

  @IsDateString()
  expectedUpdatedAt!: string
}
