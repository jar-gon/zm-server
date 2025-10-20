import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(128)
  @ApiProperty({ name: 'account', description: '账号', required: false })
  account?: string;

  @Min(1)
  @IsInt()
  @Max(Number.MAX_SAFE_INTEGER)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? Number(value) : value))
  @ApiProperty({ name: 'pageNo', description: '页码', required: true })
  pageNo: number;

  @Min(1)
  @IsInt()
  @Max(100)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? Number(value) : value))
  @ApiProperty({ name: 'pageSize', description: '页条数', required: true })
  pageSize: number;
}
