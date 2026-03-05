import { IsEmail, IsNotEmpty, IsEnum } from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateInviteDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @IsEnum(UserRole)
  role: UserRole;
}
