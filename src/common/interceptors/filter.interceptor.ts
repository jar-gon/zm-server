import { Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import type { Response } from 'express';

@Catch(HttpException)
export class HttpFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const status = exception.getStatus();
    const message = exception.message;
    let data: unknown = exception.getResponse();
    if (data !== null && typeof data === 'object' && Object.hasOwn(data, 'message')) {
      data = (data as { message: unknown }).message;
    }
    const response: Response = host.switchToHttp().getResponse();
    console.info('catch', status, message, data);
    return response.status(status).json({
      code: status,
      message,
      data,
    });
  }
}
