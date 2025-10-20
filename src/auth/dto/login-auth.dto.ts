import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAuthDot {
  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  @ApiProperty({ name: 'account', description: '账号', required: true })
  account: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ name: 'password', description: '密码', required: true })
  password: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(128)
  @ApiProperty({ name: 'captcha', description: '验证码', required: true })
  captcha: string;
}
