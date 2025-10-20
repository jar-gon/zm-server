import { Injectable, BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { JwtService } from '@nestjs/jwt';
import type { SessionData } from 'express-session';
import { UserService } from 'src/user/user.service';
import { lastValueFrom } from 'rxjs';
import { _compare } from 'src/utils/bcrypt';
import { LoginAuthDot } from './dto/login-auth.dto';
import { CaptchaUseService } from './captcha-use.service';

type CaptchaResponse = {
  code?: number;
  data?: unknown;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly captchaUseService: CaptchaUseService
  ) {}
  async login(session: SessionData, loginAuthDot: LoginAuthDot) {
    // 验证码校验
    const { account, password, captcha } = loginAuthDot;
    const expectedCaptcha = session.captcha;
    const captchaId = session.captchaId;
    const expiresAt = session.captchaExpiresAt;
    delete session.captcha;
    delete session.captchaId;
    delete session.captchaExpiresAt;
    if (!expectedCaptcha || !captchaId || !expiresAt || expiresAt <= Date.now()) {
      throw new BadRequestException('验证码已失效');
    }
    if (!(await this.captchaUseService.consume(captchaId, expiresAt))) {
      throw new BadRequestException('验证码已失效');
    }
    if (expectedCaptcha.toLowerCase() !== captcha.toLowerCase()) {
      throw new BadRequestException('验证码错误');
    }
    // 密码校验
    const user = await this.userService.findOneByName(account).catch((error: unknown) => {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException('账号或密码错误');
      }
      throw error;
    });
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const isMatch = await _compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('账号或密码错误');
    }
    const payload = { sub: user.id, account: user.account, role: user.role };
    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  async testAxios(): Promise<unknown> {
    const port = this.configService.get<number>('http.port', 3000);
    const prefix = this.configService.get<string>('API_PREFIX', 'api').replace(/^\/+|\/+$/g, '');
    const response = await lastValueFrom(
      this.httpService.get<CaptchaResponse>(`http://127.0.0.1:${port}/${prefix ? `${prefix}/` : ''}common/captcha`, {
        timeout: 5000,
      })
    );
    return response.data.code === 200 ? response.data.data : response.data;
  }
}
