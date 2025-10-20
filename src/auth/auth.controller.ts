import { Controller, Post, Res, Session, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { SessionData } from 'express-session';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomResponse } from 'src/config/custom.response';
import { AuthService } from './auth.service';
import { Public } from 'src/common/decorators/public.decorator';
import { LoginAuthDot } from './dto/login-auth.dto';

@Controller('auth')
@ApiTags('授权接口')
export class AuthController {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: '登录', description: '' })
  async login(@Session() session: SessionData, @Body() loginAuthDot: LoginAuthDot, @Res() res: Response) {
    const { accessToken } = await this.authService.login(session, loginAuthDot);
    res.cookie('accessToken', accessToken, this.getCookieOptions());
    return res.send(new CustomResponse({ accessToken }));
  }

  @Post('logout')
  logout(@Res() res: Response) {
    res.clearCookie('accessToken', this.getCookieOptions());
    res.send(new CustomResponse('Logout successful'));
  }

  private getCookieOptions(): CookieOptions {
    const cookie = this.configService.get<CookieOptions & { domain?: string | null }>('cookie') ?? {};
    if (!cookie.domain) {
      const options = { ...cookie };
      delete options.domain;
      return options;
    }
    return cookie;
  }

  @Post('testAxios')
  @HttpCode(HttpStatus.OK)
  @Public()
  @ApiOperation({ summary: '测试axios', description: '' })
  testAxios() {
    return this.authService.testAxios();
  }
}
