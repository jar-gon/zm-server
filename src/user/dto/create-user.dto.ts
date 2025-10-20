import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  @Matches(/\S/)
  @MaxLength(128)
  @ApiProperty({ name: 'account', description: '账号', required: true })
  account: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ name: 'password', description: '密码', required: true })
  password: string;
}
