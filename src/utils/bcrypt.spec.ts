import { saltHash, _compare } from './bcrypt';
import { BadRequestException } from '@nestjs/common';

describe('password hashing', () => {
  it('hashes passwords and verifies only the correct password', async () => {
    const hash = await saltHash('password');
    expect(hash).not.toBe('password');
    await expect(_compare('password', hash)).resolves.toBe(true);
    await expect(_compare('different', hash)).resolves.toBe(false);
  });

  it('rejects passwords that bcrypt would silently truncate by byte length', async () => {
    await expect(saltHash('密'.repeat(25))).rejects.toBeInstanceOf(BadRequestException);
  });
});
