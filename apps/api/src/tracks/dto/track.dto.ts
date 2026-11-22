import { Transform } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'

/**
 * C8 PR3-1 — explicit request bodies for tracks.
 *
 * The global ValidationPipe (whitelist + forbidNonWhitelisted) only enforces classes, so inline
 * body types let any field through to Prisma. Only the fields below are accepted: organization,
 * status, slug, version and other internal fields are rejected with 400 before reaching a service.
 */

export const TRACK_TITLE_MAX_LENGTH = 200
export const TRACK_DESCRIPTION_MAX_LENGTH = 5000
export const TRACK_ITEM_CONTENT_MAX_LENGTH = 50000
export const TRACK_PEOPLE_MAX = 500

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class CreateTrackDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Título da trilha é obrigatório' })
  @MaxLength(TRACK_TITLE_MAX_LENGTH)
  title!: string

  @IsOptional()
  @IsString()
  @MaxLength(TRACK_DESCRIPTION_MAX_LENGTH)
  description?: string
}

export class UpdateTrackDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'Título da trilha não pode ser vazio' })
  @MaxLength(TRACK_TITLE_MAX_LENGTH)
  title?: string

  @IsOptional()
  @IsString()
  @MaxLength(TRACK_DESCRIPTION_MAX_LENGTH)
  description?: string
}

/** `CONTENT` is a legacy alias accepted by POST /tracks/:id/items and mapped to `READING`. */
export const TRACK_ITEM_INPUT_TYPES = ['READING', 'ACTION', 'CHECKPOINT', 'CONTENT'] as const
export type TrackItemInputType = (typeof TRACK_ITEM_INPUT_TYPES)[number]

export class AddTrackItemDto {
  @IsIn(TRACK_ITEM_INPUT_TYPES)
  type!: TrackItemInputType

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

/** Body of POST /tracks/:id/assign and /unassign. Missing list keeps the previous no-op behaviour. */
export class TrackPeopleDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TRACK_PEOPLE_MAX)
  @ArrayUnique()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  personIds?: string[]
}
