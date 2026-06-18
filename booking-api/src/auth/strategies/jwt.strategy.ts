import { Injectable, Logger, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/redis/redis.service';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti?: string;
  exp?: number;
}

// Fail closed: refuse to start without a configured secret rather than silently
// accepting tokens signed with a well-known fallback.
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set — refusing to start.');

// The web app sends the access token as an HttpOnly `booking_token` cookie
// (immune to XSS theft); the same-origin /proxy forwards it here. Mobile keeps
// using the Authorization: Bearer header. Try the header first, then the cookie.
function cookieExtractor(req: { headers?: { cookie?: string } }): string | null {
  const raw = req?.headers?.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === 'booking_token') return decodeURIComponent(v.join('='));
  }
  return null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private prisma: PrismaService, private redis: RedisService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor,
      ]),
      secretOrKey: JWT_SECRET!, // guaranteed non-null by the startup guard above
    });
  }

  async validate(payload: JwtPayload & { kind?: string }) {
    if (payload.kind === 'ws') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { 
        id: true, 
        email: true, 
        name: true,
        phone: true,
        role: true, 
        businessId: true,
        avatarUrl: true,
        emailVerified: true,
        mustResetPassword: true,
        twoFactorEnabled: true,
        twoFactorMethod: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new UnauthorizedException();

    if (payload.jti) {
      const revoked = await this.redis.client.exists(`auth:revoked:${payload.jti}`).catch((err) => {
        // Change to Fail-Closed in production
        if (process.env.NODE_ENV === 'production') {
          this.logger.error(`[auth] Revocation check failed (FAIL-CLOSED): ${err instanceof Error ? err.message : String(err)}`);
          throw new ServiceUnavailableException('Security service unavailable');
        }
        return 0;
      });
      if (revoked) throw new UnauthorizedException();
    }

    return { ...user, _jti: payload.jti, _tokenExp: payload.exp, _kind: payload.kind };
  }
}
