import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(@Optional() private prisma?: PrismaService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Log 5xx errors to Sentry and SystemError table (best-effort, non-blocking)
    if (status >= 500) {
      if (exception instanceof Error) Sentry.captureException(exception);
      const err = exception instanceof Error ? exception : null;
      const bizId: string | undefined = (request as any)?.user?.businessId ?? undefined;
      const logPath = request.url.split('?')[0];
      this.logger.error(`${request.method} ${logPath} → ${status}: ${err?.message ?? String(message)}`);
      if (this.prisma) {
        // Tenants see these errors in their dashboard — NEVER leak stack traces,
        // PII, or internal system details here.
        this.prisma.systemError.create({
          data: {
            businessId: bizId ?? null,
            category: 'GENERAL',
            severity: 'ERROR',
            message: 'A system error occurred. Please contact support.',
            stack: null, // Detailed stack is in Sentry, never in the DB
            context: {
              method: request.method,
              path: logPath,
              statusCode: status,
              requestId: request.headers['x-request-id'] || null,
            },
          },
        }).catch(() => {});
      }
    }

    // Strip query params before echoing the path — tokens passed as ?token= must
    // never appear in error bodies returned to the client or logged by Sentry.
    const safePath = request.url.split('?')[0];
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: safePath,
      message,
    });
  }
}
