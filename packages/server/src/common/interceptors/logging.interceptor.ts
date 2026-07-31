import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const { method, originalUrl } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = http.getResponse<Response>();
          this.logger.log(`${method} ${originalUrl} ${response.statusCode} ${Date.now() - start}ms`);
        },
        error: (err: { status?: number; message?: string }) => {
          const status = err?.status ?? 500;
          this.logger.warn(`${method} ${originalUrl} ${status} ${Date.now() - start}ms ${err?.message ?? ''}`);
        },
      }),
    );
  }
}
