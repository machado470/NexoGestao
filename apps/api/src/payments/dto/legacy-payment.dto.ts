import { PartialType } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsIn, ValidateIf } from 'class-validator'
import { CreatePaymentDto } from '../../finance/dto/create-payment.dto'

export class LegacyPaymentDto extends PartialType(CreatePaymentDto, { skipNullProperties: false }) {
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value
    const normalized = value.trim().toUpperCase()
    return normalized === 'MANUAL' ? 'OTHER' : normalized
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER'])
  paymentMethod?: CreatePaymentDto['method']
}
