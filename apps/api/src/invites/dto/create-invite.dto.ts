import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator'

export const InviteUserRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
  VIEWER: 'VIEWER',
} as const

export type InviteUserRole =
  (typeof InviteUserRole)[keyof typeof InviteUserRole]

export class CreateInviteDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string

  @IsNotEmpty()
  @IsEnum(InviteUserRole)
  role!: InviteUserRole
}
