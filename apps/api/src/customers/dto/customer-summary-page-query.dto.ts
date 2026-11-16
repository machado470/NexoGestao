import { Transform } from 'class-transformer'
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator'

export class CustomerSummaryPageQueryDto {
  @Transform(({value}) => Array.isArray(value) ? value : value ? [value] : [])
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', {each:true})
  customerIds: string[] = []
}
