import { BadRequestException } from '@nestjs/common';
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
    const service = new AuthService(userService as never, jwtService as never, httpService as never);
    return { service, userService, jwtService };
  };

  it('rejects login when captcha is missing from session', async () => {
    const { service } = createService();

    await expect(
      service.login({} as SessionData, { account: 'test', password: 'password', captcha: 'abcd' })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('signs token with user role after captcha and password pass', async () => {
    const { service, jwtService } = createService();

    await service.login({ captcha: 'AbCd' } as SessionData, { account: 'test', password: 'password', captcha: 'abcd' });

    expect(jwtService.signAsync).toHaveBeenCalledWith({ sub: 'user-id', account: 'test', role: 'admin' });
  });
});
