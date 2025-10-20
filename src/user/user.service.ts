import { Model, Types } from 'mongoose';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { escapeRegex } from 'src/utils';
import { saltHash } from 'src/utils/bcrypt';
import { User } from 'src/schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { SearchUserDto } from './dto/search-user.dto';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async create(createUserDto: CreateUserDto): Promise<boolean> {
    const { account, password } = createUserDto;
    // 检查账号是否已存在
    const existingUser = await this.userModel.findOne({ account });
    if (existingUser) {
      throw new ConflictException('账号已存在');
    }

    const hashPwd = await saltHash(password);
    const createdUser = new this.userModel({
      account,
      password: hashPwd,
    });
    await createdUser.save();
    return true;
  }

  async findAllPaginate(searchUserDto: SearchUserDto): Promise<Record<string, any>> {
    const { pageNo, pageSize, account } = searchUserDto;
    const skip = (pageNo - 1) * pageSize;
    const filter: Record<string, unknown> = { isDeleted: false };
    if (account) {
      filter.account = { $regex: new RegExp(escapeRegex(account), 'i') };
    }
    const [dataList, total] = await Promise.all([
      this.userModel.find(filter).skip(skip).limit(pageSize).sort({ createdAt: -1 }).exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);
    const totalPages = Math.ceil(total / pageSize);
    return {
      dataList,
      pageNo,
      pageSize,
      totalPages,
      total,
    };
  }

  async findOneByName(account: string): Promise<User> {
    const user = await this.userModel.findOne({ account, isDeleted: false }).select('+password').exec();
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async findOne(_id: Types.ObjectId): Promise<User> {
    const user = await this.userModel.findOne({ _id, isDeleted: false }).exec();
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async update(_id: Types.ObjectId, updateUserDto: UpdateUserDto): Promise<boolean> {
    const user = await this.userModel
      .findOneAndUpdate({ _id, isDeleted: false }, { $set: updateUserDto }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return true;
  }

  async remove(_id: Types.ObjectId): Promise<boolean> {
    const user = await this.userModel
      .findOneAndUpdate({ _id, isDeleted: false }, { $set: { isDeleted: true } }, { new: true })
      .exec();
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return true;
  }
}
