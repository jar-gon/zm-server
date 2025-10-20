import { ExecutionContext, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  const id = '507f1f77bcf86cd799439011';
  const createGuard = (authorization?: string, accessToken?: string) => {
    const request = { headers: { authorization }, cookies: { accessToken }, user: undefined };
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: id, role: 'admin' }) };
    const users = { findOne: jest.fn().mockResolvedValue({ id, account: 'user', role: 'user' }) };
    const guard = new AuthGuard(reflector as never, new ConfigService(), jwt as never, users as never);
    return { guard, context, request, jwt, users, reflector };
  };

  it('uses the current database role instead of the signed role', async () => {
    const { guard, context, request } = createGuard('bearer token');
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ sub: id, account: 'user', role: 'user' });
  });

  it('supports cookie authentication when no Authorization header is present', async () => {
    const { guard, context, jwt } = createGuard(undefined, 'cookie-token');
    await guard.canActivate(context);
    expect(jwt.verifyAsync).toHaveBeenCalledWith('cookie-token', expect.any(Object));
  });

  it('does not fall back to cookies when an explicit Authorization header is invalid', async () => {
    const { guard, context, jwt } = createGuard('Basic invalid', 'cookie-token');
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures and subjects before querying users', async () => {
    const { guard, context, jwt, users } = createGuard('Bearer invalid');
    jwt.verifyAsync.mockRejectedValueOnce(new Error('bad signature'));
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    jwt.verifyAsync.mockResolvedValueOnce({ sub: 'invalid', role: 'admin' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(users.findOne).not.toHaveBeenCalled();
  });

  it('rejects deleted users while preserving database failures', async () => {
    const { guard, context, users } = createGuard('Bearer token');
    users.findOne.mockRejectedValueOnce(new NotFoundException());
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
    users.findOne.mockRejectedValueOnce(new Error('database offline'));
    await expect(guard.canActivate(context)).rejects.toThrow('database offline');
  });

  it('skips authentication for public routes', async () => {
    const { guard, context, reflector, jwt } = createGuard();
    reflector.getAllAndOverride.mockReturnValueOnce(true);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(jwt.verifyAsync).not.toHaveBeenCalled();
  });
});
