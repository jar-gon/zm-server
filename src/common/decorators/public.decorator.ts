import { SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export const IS_PUBLIC_KEY = 'isPublic';
export const Roles = Reflector.createDecorator<string[]>();
// export const Public = Reflector.createDecorator<boolean>();
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
