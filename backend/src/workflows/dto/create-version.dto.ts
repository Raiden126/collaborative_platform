import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateVersionDto {
  @ApiPropertyOptional({ example: 'Added SMS fallback branch' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}
