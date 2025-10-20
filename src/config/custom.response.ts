import { HttpStatus } from '@nestjs/common';

export class CustomResponse<T = any> {
  code: number;
  message: string;
  data: T;

  constructor(data: T, code?: number, message?: string) {
    this.data = data;
    this.code = code ?? HttpStatus.OK;
    this.message = message ?? 'success';
  }
}
