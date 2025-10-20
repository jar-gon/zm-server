import { IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginAuthDot {
  @IsNotEmpty()
  @ApiProperty({ name: 'account', description: '账号', required: true })
  account: string;

  @IsNotEmpty()
  @ApiProperty({ name: 'password', description: '密码', required: true })
  password: string;

  @IsNotEmpty()
  @Length(4, 4)
  @ApiProperty({ name: 'captcha', description: '验证码', required: true })
  captcha: string;
}
