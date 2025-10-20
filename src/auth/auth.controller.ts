import { Controller, Post, Req, Res, Body, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CustomResponse } from 'src/config/custom.response';
import { AuthService } from './auth.service';
import { Public, Roles } from 'src/common/decorators/public.decorator';
import { getCookieOptions } from 'src/config/setup-app';
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
  @Header('Cache-Control', 'no-store')
  @Public()
  @ApiOperation({ summary: '登录', description: '' })
  async login(@Req() req: Request, @Body() loginAuthDot: LoginAuthDot, @Res() res: Response) {
    const { accessToken } = await this.authService.login(req.session, loginAuthDot);
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((error: unknown) => {
        if (error) reject(error instanceof Error ? error : new Error('更新 session 失败', { cause: error }));
        else resolve();
      })
    );
    res.cookie('accessToken', accessToken, getCookieOptions(this.configService));
    return res.send(new CustomResponse({ accessToken }));
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  @Public()
  @ApiOperation({ summary: '登出', description: '令牌失效后仍可销毁 session 并清理 Cookie' })
  async logout(@Req() req: Request, @Res() res: Response) {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((error: unknown) => {
        if (error) reject(error instanceof Error ? error : new Error('销毁 session 失败', { cause: error }));
        else resolve();
      })
    );
    const options = getCookieOptions(this.configService);
    delete options.maxAge;
    delete options.expires;
    res.clearCookie('accessToken', options);
    res.clearCookie(this.configService.get<string>('session.name', 'connect.sid'), options);
    res.send(new CustomResponse('Logout successful'));
  }

  @Post('testAxios')
  @HttpCode(HttpStatus.OK)
  @Roles(['admin'])
  @ApiBearerAuth()
  @ApiOperation({ summary: '测试axios', description: '' })
  testAxios() {
    return this.authService.testAxios();
  }
}
