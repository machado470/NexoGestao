import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';

export const InviteUserRole = {
  ADMIN: 'ADMIN',
  COLLABORATOR: 'COLLABORATOR',
} as const;

export type InviteUserRole = (typeof InviteUserRole)[keyof typeof InviteUserRole];

export class CreateInviteDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsEnum(InviteUserRole)
  role: InviteUserRole;
}
