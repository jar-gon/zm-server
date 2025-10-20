import { readFileSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppModule } from '../app.module';
import { User } from '../schemas/user.schema';
import { Role } from '../common/interfaces/common.interface';
import { saltHash } from '../utils/bcrypt';

async function createAdmin() {
  const account = process.argv[2];
  if (!account || !/\S/.test(account) || account.length > 128 || process.stdin.isTTY) {
    throw new Error('用法：通过标准输入传入密码，执行 yarn admin:create <账号>（需先 yarn build）');
  }
  const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '');
  if (!password) {
    throw new Error('密码不能为空');
  }
  const hashedPassword = await saltHash(password);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const userModel = app.get<Model<User>>(getModelToken(User.name));
    await userModel.init();
    await userModel.create({ account, password: hashedPassword, role: Role.ADMIN });
    console.info('管理员已创建');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      throw new Error('账号已存在，未修改已有用户', { cause: error });
    }
    throw error;
  } finally {
    await app.close();
  }
}

void createAdmin().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : '创建管理员失败');
  process.exitCode = 1;
});
