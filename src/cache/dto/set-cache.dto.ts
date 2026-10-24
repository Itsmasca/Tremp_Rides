import { IsDefined, IsInt, IsOptional, Max, Min } from 'class-validator';

export class SetCacheDto {
  @IsDefined()
  value: unknown;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60 * 60 * 24 * 30)
  ttl?: number;
}
