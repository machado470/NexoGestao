import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator'

export const InternalUserRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
  VIEWER: 'VIEWER',
} as const

export type InternalUserRole =
  (typeof InternalUserRole)[keyof typeof InternalUserRole]

export const InviteUserRole = {
  ...InternalUserRole,
  CONTRACTOR: 'CONTRACTOR',
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
