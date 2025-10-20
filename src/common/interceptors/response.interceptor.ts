import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CustomResponse } from 'src/config/custom.response';

interface data<T> {
  data: T;
}

@Injectable()
export class Response<T = any> implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<data<T>> {
    return next.handle().pipe(
      map(data => {
        console.info('response', data);
        return new CustomResponse(data);
      })
    );
  }
}
