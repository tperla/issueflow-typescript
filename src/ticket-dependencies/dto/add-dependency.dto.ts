import { IsInt, IsPositive } from 'class-validator';

export class AddDependencyDto {
  @IsInt()
  @IsPositive()
  blockerId: number;
}
