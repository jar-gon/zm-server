import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SearchUserDto {
  @ApiProperty({ name: 'account', description: '账号' })
  account?: string;

  @Min(1)
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ name: 'pageNo', description: '页码', required: true })
  pageNo: number;

  @Min(1)
  @IsNumber()
  @Type(() => Number)
  @ApiProperty({ name: 'pageSize', description: '页条数', required: true })
  pageSize: number;
}
