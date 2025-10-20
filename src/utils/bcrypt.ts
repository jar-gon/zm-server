import { genSalt, hash, compare } from 'bcrypt';
import { BadRequestException } from '@nestjs/common';

export const saltHash = async (str: string) => {
  if (Buffer.byteLength(str, 'utf8') > 72) {
    throw new BadRequestException('密码不能超过 72 个 UTF-8 字节');
  }
  const salt = await genSalt();
  const hashStr = await hash(str, salt);
  return hashStr;
};

export const _compare = compare;
