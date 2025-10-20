import { model } from 'mongoose';
import { UserSchema } from './user.schema';

describe('User serialization', () => {
  it('includes formatted timestamps and excludes sensitive fields even when selected', () => {
    const UserModel = model('SerializationTestUser', UserSchema);
    const user = UserModel.hydrate({
      account: 'alice',
      password: 'hash',
      isDeleted: false,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-02T00:00:00Z'),
    });
    const json = user.toJSON();
    expect(json).toEqual(
      expect.objectContaining({
        account: 'alice',
        createdTime: expect.any(String) as unknown,
        updatedTime: expect.any(String) as unknown,
      })
    );
    for (const field of ['_id', 'password', 'isDeleted', 'createdAt', 'updatedAt']) {
      expect(json).not.toHaveProperty(field);
    }
  });
});
