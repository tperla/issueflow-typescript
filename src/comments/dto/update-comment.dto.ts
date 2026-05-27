import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsOptional()
  @IsInt()
  version?: number;
}
