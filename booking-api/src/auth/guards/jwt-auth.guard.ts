import { Injectable, CanActivate, ForbiddenException, UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Endpoints a user flagged for forced password reset may still call.
const RESET_ALLOWED = [
  '/api/auth/change-password',
  '/api/auth/logout',
  '/api/auth/me',
  '/api/auth/resend-verification',
];

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = any>(err: any, user: any, info: any, context: ExecutionContext): TUser {
    const resolved = super.handleRequest(err, user, info, context) as TUser & { mustResetPassword?: boolean };
    if (resolved?.mustResetPassword) {
      const req = context.switchToHttp().getRequest<{ path: string }>();
      if (!RESET_ALLOWED.includes(req.path)) {
        throw new ForbiddenException({ code: 'PASSWORD_RESET_REQUIRED', message: 'You must reset your password before continuing.' });
      }
    }
    return resolved;
  }
}

@Injectable()
export class JwtRefreshGuard extends AuthGuard('jwt-refresh') {}

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    return user || null;
  }
}

@Injectable()
export class AdminTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: { _kind?: string } }>();
    if (req.user?._kind !== 'admin') throw new UnauthorizedException('Admin session required');
    return true;
  }
}
