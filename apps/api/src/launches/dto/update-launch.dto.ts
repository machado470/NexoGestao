import { PartialType } from '@nestjs/swagger'
import { CreateLaunchDto } from './create-launch.dto'

export class UpdateLaunchDto extends PartialType(CreateLaunchDto, { skipNullProperties: false }) {}
