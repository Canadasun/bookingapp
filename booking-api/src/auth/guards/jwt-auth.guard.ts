import { Injectable, ForbiddenException, ExecutionContext } from '@nestjs/common';
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
