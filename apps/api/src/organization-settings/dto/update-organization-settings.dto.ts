import { Transform } from 'class-transformer'
import { IsString, IsIn, IsNotEmpty, IsTimeZone, ValidateIf, Matches } from 'class-validator'

const trimText = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value

export class UpdateOrganizationSettingsDto {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimText)
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome da organização.' })
  name?: string

  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trimText)
  @IsString()
  @Matches(/^(?![+-])/, { message: 'Use um fuso horário nomeado, como America/Sao_Paulo ou UTC.' })
  @IsTimeZone({ message: 'Informe um fuso horário válido, como America/Sao_Paulo ou UTC.' })
  timezone?: string

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsIn(['BRL', 'USD', 'EUR'], { message: 'Moeda inválida. Use BRL, USD ou EUR.' })
  currency?: string
}
