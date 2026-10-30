import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';

@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const defaultPayload = {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
      },
    };

    const raw = exception instanceof HttpException ? exception.getResponse() : defaultPayload;

    const payload =
      typeof raw === 'object' && raw !== null && 'error' in raw
        ? raw
        : {
            error: {
              code: 'INTERNAL_ERROR',
              message: typeof raw === 'string' ? raw : 'An unexpected error occurred.',
            },
          };

    response.status(status).send(payload);
  }
}
