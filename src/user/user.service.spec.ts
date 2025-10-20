import { UserService } from './user.service';

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
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
  });
});
