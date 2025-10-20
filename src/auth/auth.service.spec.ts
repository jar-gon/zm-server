import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { _compare } from 'src/utils/bcrypt';
import type { SessionData } from 'express-session';
import { AuthService } from './auth.service';

jest.mock('src/utils/bcrypt', () => ({
  _compare: jest.fn().mockResolvedValue(true),
}));

describe('AuthService', () => {
  const createService = () => {
    const userService = {
      findOneByName: jest.fn().mockResolvedValue({
        id: 'user-id',
        account: 'test',
        password: 'hashed-password',
        role: 'admin',
      }),
    };
    const jwtService = {
      signAsync: jest.fn().mockResolvedValue('token'),
    };
    const httpService = {
      get: jest.fn(),
    };
    const captchaUses = { consume: jest.fn().mockResolvedValue(true) };
    const service = new AuthService(
      userService as never,
      jwtService as never,
      httpService as never,
      new ConfigService(),
      captchaUses as never
    );
    return { service, userService, jwtService, captchaUses };
  };

  it('rejects login when captcha is missing from session', async () => {
    const { service } = createService();

    await expect(
      service.login({} as SessionData, { account: 'test', password: 'password', captcha: 'abcd' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signs token with user role after captcha and password pass', async () => {
    const { service, jwtService } = createService();

    const session = { captcha: 'AbCd', captchaId: 'challenge', captchaExpiresAt: Date.now() + 10000 } as SessionData;
    await service.login(session, { account: 'test', password: 'password', captcha: 'abcd' });

    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-id', account: 'test', role: 'admin' });
    expect(session.captcha).toBeUndefined();
    expect(session.captchaId).toBeUndefined();
    expect(session.captchaExpiresAt).toBeUndefined();
  });

  it.each([
    { captcha: 'AbCd', captchaId: 'challenge', captchaExpiresAt: Date.now() - 10000 },
    { captcha: 'wrong', captchaId: 'challenge', captchaExpiresAt: Date.now() + 60000 },
  ])('consumes expired or incorrect captchas before querying users', async session => {
    const { service, userService } = createService();
    await expect(
      service.login(session as SessionData, { account: 'test', password: 'password', captcha: 'abcd' })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(userService.findOneByName).not.toHaveBeenCalled();
    expect(session.captcha).toBeUndefined();
  });

  it('does not disclose whether an account exists', async () => {
    const { service, userService } = createService();
    userService.findOneByName.mockRejectedValueOnce(new NotFoundException());
    await expect(
      service.login({ captcha: 'abcd', captchaId: 'challenge', captchaExpiresAt: Date.now() + 10000 } as SessionData, {
        account: 'missing',
        password: 'password',
        captcha: 'abcd',
      })
    ).rejects.toThrow(new UnauthorizedException('账号或密码错误'));
  });

  it('rejects a wrong password without signing a token', async () => {
    const { service, jwtService } = createService();
    jest.mocked(_compare as (password: string, hash: string) => Promise<boolean>).mockResolvedValueOnce(false);
    await expect(
      service.login({ captcha: 'abcd', captchaId: 'challenge', captchaExpiresAt: Date.now() + 10000 } as SessionData, {
        account: 'test',
        password: 'wrong',
        captcha: 'abcd',
      })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });

  it('rejects an already consumed captcha before checking credentials', async () => {
    const { service, captchaUses, userService, jwtService } = createService();
    captchaUses.consume.mockResolvedValueOnce(false);
    await expect(
      service.login({ captcha: 'abcd', captchaId: 'challenge', captchaExpiresAt: Date.now() + 10000 } as SessionData, {
        account: 'test',
        password: 'password',
        captcha: 'abcd',
      })
    ).rejects.toThrow('验证码已失效');
    expect(userService.findOneByName).not.toHaveBeenCalled();
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});
