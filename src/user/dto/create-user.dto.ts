import { IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @IsNotEmpty()
  @ApiProperty({ name: 'account', description: '账号', required: true })
  account: string;

  @IsNotEmpty()
  @ApiProperty({ name: 'password', description: '密码', required: true })
  password: string;
}
