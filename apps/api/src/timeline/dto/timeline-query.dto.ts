import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { Transform } from 'class-transformer'

export class TimelineQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number

  /**
   * Cursor no formato: "<createdAtISO>_<id>"
   * Ex: "2026-02-27T00:33:21.647Z_b20aaa14-7647-408a-aba9-6965fb8d4d6c"
   */
  @IsOptional()
  @IsString()
  cursor?: string
}
