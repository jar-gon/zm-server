import { genSalt, hash, compare } from 'bcrypt';

export const saltHash = async (str: string) => {
  const salt = await genSalt();
  const hashStr = await hash(str, salt);
  return hashStr;
};

export const _compare = compare;
