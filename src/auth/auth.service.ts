import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import type { SessionData } from 'express-session';
import { UserService } from 'src/user/user.service';
import { lastValueFrom } from 'rxjs';
import { _compare } from 'src/utils/bcrypt';
import { LoginAuthDot } from './dto/login-auth.dto';

type CaptchaResponse = {
  code?: number;
  data?: unknown;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService
  ) {}
  async login(session: SessionData, loginAuthDot: LoginAuthDot) {
    // 验证码校验
    const { account, password, captcha } = loginAuthDot;
    if (!session.captcha) {
      throw new BadRequestException('验证码已失效');
    }
    if (session.captcha.toLocaleLowerCase() !== captcha.toLocaleLowerCase()) {
      delete session.captcha;
      throw new BadRequestException('验证码错误');
    }
    delete session.captcha;
    // 密码校验
    const user = await this.userService.findOneByName(account);
    const isMatch = await _compare(password, user.password);
    if (!isMatch) {
      throw new BadRequestException('密码错误');
    }
    const payload = { sub: user.id, account: user.account, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async testAxios(): Promise<unknown> {
    const response = await lastValueFrom(
      this.httpService.get<CaptchaResponse>('http://localhost:3000/api/common/captcha')
    );
    return response.data.code === 200 ? response.data.data : response.data;
  }
}
