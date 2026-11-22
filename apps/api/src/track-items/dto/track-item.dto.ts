import { Transform } from 'class-transformer'
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator'
import {
  TRACK_ITEM_CONTENT_MAX_LENGTH,
  TRACK_TITLE_MAX_LENGTH,
} from '../../tracks/dto/track.dto'

/**
 * C8 PR3-1 — explicit request bodies for track items. `trackId`, `order` and any other internal
 * field are rejected with 400 (ValidationPipe whitelist + forbidNonWhitelisted): an item can never
 * be moved to another track (possibly of another organization) through the request body.
 */

export const TRACK_ITEM_TYPES = ['READING', 'ACTION', 'CHECKPOINT'] as const
export type TrackItemTypeValue = (typeof TRACK_ITEM_TYPES)[number]

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CreateTrackItemDto {
  @IsIn(TRACK_ITEM_TYPES)
  type!: TrackItemTypeValue

  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Título do item é obrigatório' })
  @MaxLength(TRACK_TITLE_MAX_LENGTH)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(TRACK_ITEM_CONTENT_MAX_LENGTH)
  content?: string
}

export class UpdateTrackItemDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Título do item não pode ser vazio' })
  @MaxLength(TRACK_TITLE_MAX_LENGTH)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(TRACK_ITEM_CONTENT_MAX_LENGTH)
  content?: string
}
