import { ConfigService } from '@nestjs/config';
import { CaptchaUseService } from './captcha-use.service';

describe('one-time captcha consumption', () => {
  afterEach(() => jest.restoreAllMocks());

  it('consumes a challenge once when requests arrive concurrently', async () => {
    const service = new CaptchaUseService(new ConfigService(), {} as never);
    const expiry = Date.now() + 10000;
    expect(await Promise.all([service.consume('same', expiry), service.consume('same', expiry)])).toEqual([
      true,
      false,
    ]);
    await expect(service.consume('new', expiry)).resolves.toBe(true);
  });

  it('rejects expired challenges and clears old memory entries', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const service = new CaptchaUseService(new ConfigService(), {} as never);
    await expect(service.consume('expired', 1000)).resolves.toBe(false);
    await expect(service.consume('old', 2000)).resolves.toBe(true);
    clock.mockReturnValue(62000);
    await expect(service.consume('old', 63000)).resolves.toBe(true);
  });

  it('preserves storage failures instead of treating the captcha as consumed successfully', async () => {
    const collection = {
      createIndex: jest.fn().mockResolvedValue('expires_1'),
      insertOne: jest.fn().mockRejectedValue(new Error('database offline')),
    };
    const connection = { name: 'test', getClient: () => ({ db: () => ({ collection: () => collection }) }) };
    const service = new CaptchaUseService(new ConfigService({ sessionStore: 'mongo' }), connection as never);
    await service.onModuleInit();
    await expect(service.consume('challenge', Date.now() + 10000)).rejects.toThrow('database offline');
  });
});
