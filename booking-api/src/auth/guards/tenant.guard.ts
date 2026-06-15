import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const SKIP_TENANT_GUARD_KEY = 'skipTenantGuard';

/**
 * Apply to any handler or controller that legitimately operates across tenant
 * boundaries (e.g. ADMIN-only routes, public availability endpoints).
 */
export const SkipTenantGuard = () => SetMetadata(SKIP_TENANT_GUARD_KEY, true);

/**
 * Reusable tenant isolation guard — replaces the manual inline check:
 *   `if (user.role !== 'ADMIN' && user.businessId !== businessId) throw ForbiddenException()`
 *
 * Usage:
 *   @UseGuards(JwtAuthGuard, TenantGuard)
 *   @Controller('businesses/:businessId/...')
 *
 * The guard reads :businessId from the route params and asserts it matches
 * the businessId stored on the authenticated user. ADMIN role bypasses the
 * check. Routes without a :businessId param are passed through unchanged.
 *
 * Apply AFTER JwtAuthGuard so that req.user is already populated.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // Allow explicit opt-out for cross-tenant or public routes
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_TENANT_GUARD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { role: string; businessId: string | null };
      params?: { businessId?: string };
    }>();

    const user = request.user;
    const businessId = request.params?.businessId;

    // Route has no :businessId path param — not a tenant-scoped endpoint.
    if (!businessId) return true;

    // If the JWT guard has not run and a businessId is required, fail closed.
    if (!user) throw new ForbiddenException('Authentication required');

    if (user.role !== Role.ADMIN && user.businessId !== businessId) {
      throw new ForbiddenException('Access denied to this business resource');
    }

    return true;
  }
}
