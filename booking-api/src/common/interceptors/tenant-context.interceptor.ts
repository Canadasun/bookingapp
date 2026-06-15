import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { defer, Observable } from 'rxjs';
import { tenantContext } from '../util/tenant-context';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      user?: { role?: string; businessId?: string | null };
    }>();
    const businessId = request.user?.role === 'ADMIN' ? null : (request.user?.businessId ?? null);
    return defer(() => tenantContext.run({ businessId }, () => next.handle()));
  }
}
