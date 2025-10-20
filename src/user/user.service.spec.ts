import { UserService } from './user.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('UserService', () => {
  it('uses the same filter for list and total count', async () => {
    const query = {
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    const countQuery = { exec: jest.fn().mockResolvedValue(0) };
    const userModel = {
      find: jest.fn().mockReturnValue(query),
      countDocuments: jest.fn().mockReturnValue(countQuery),
    };
    const service = new UserService(userModel as never);

    await service.findAllPaginate({ pageNo: 1, pageSize: 10, account: 'a.b' });

    expect(userModel.find).toHaveBeenCalledWith({ isDeleted: false, account: { $regex: /a\.b/i } });
    expect(userModel.countDocuments).toHaveBeenCalledWith({ isDeleted: false, account: { $regex: /a\.b/i } });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
  });

  it('only updates account and enables schema validation', async () => {
    const model = { findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }) };
    const service = new UserService(model as never);
    const id = new Types.ObjectId();
    await service.update(id, { account: 'renamed', role: 'admin', password: 'plain' } as never);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, isDeleted: false },
      { $set: { account: 'renamed' } },
      { returnDocument: 'after', runValidators: true }
    );
  });

  it('maps duplicate account updates to HTTP 409', async () => {
    const model = {
      findOneAndUpdate: () => ({ exec: () => Promise.reject(Object.assign(new Error('duplicate'), { code: 11000 })) }),
    };
    await expect(
      new UserService(model as never).update(new Types.ObjectId(), { account: 'duplicate' })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('handles concurrent duplicate account creation', async () => {
    const save = jest.fn().mockRejectedValue({ code: 11000 });
    const model = Object.assign(
      jest.fn().mockImplementation(() => ({ save })),
      { findOne: jest.fn().mockResolvedValue(null) }
    );
    await expect(
      new UserService(model as never).create({ account: 'duplicate', password: 'password' })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects empty updates without querying the database', async () => {
    const model = { findOneAndUpdate: jest.fn() };
    await expect(new UserService(model as never).update(new Types.ObjectId(), {})).rejects.toBeInstanceOf(
      BadRequestException
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 when updating a deleted or missing user', async () => {
    const model = { findOneAndUpdate: () => ({ exec: () => Promise.resolve(null) }) };
    await expect(
      new UserService(model as never).update(new Types.ObjectId(), { account: 'missing' })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes only active users', async () => {
    const model = { findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }) };
    const id = new Types.ObjectId();
    await new UserService(model as never).remove(id);
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } },
      { returnDocument: 'after' }
    );
  });
});
