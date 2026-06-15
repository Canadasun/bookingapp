import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { tenantContext } from '../../common/util/tenant-context';

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

    // This guard is intended for tenant-scoped controllers (e.g. /businesses/:businessId/...).
    // If the route param is missing, we allow it (non-tenant route), but 
    // real tenant isolation happens when services use the user's businessId.
    if (!businessId) return true;

    // If the JWT guard has not run and a businessId is required, fail closed.
    if (!user) throw new ForbiddenException('Authentication required');

    // ADMIN role bypasses the check for platform management.
    if (user.role === Role.ADMIN) {
      // For ADMINs, we don't set a tenant context so they can access all data.
      return true;
    }

    if (user.businessId !== businessId) {
      throw new ForbiddenException('Access denied to this business resource');
    }

    // Set the tenant context for the rest of the request lifecycle (Prisma isolation).
    tenantContext.enterWith({ businessId: user.businessId });

    return true;
  }
}
