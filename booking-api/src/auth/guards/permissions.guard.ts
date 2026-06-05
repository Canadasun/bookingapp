import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';

// Additive authorization: OWNER/ADMIN pass unconditionally (no regression to
// existing owner-only endpoints); STAFF pass only if their Staff.permissions
// include every required permission. Must run after JwtAuthGuard.
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector, private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Not authenticated');
    if (user.role === 'OWNER' || user.role === 'ADMIN') return true;

    if (user.role === 'STAFF') {
      const staff = await this.prisma.staff.findUnique({
        where: { userId: user.id },
        select: { permissions: true },
      });
      const granted = staff?.permissions ?? [];
      if (required.every((p) => granted.includes(p))) return true;
    }
    throw new ForbiddenException('You do not have permission to do that');
  }
}
