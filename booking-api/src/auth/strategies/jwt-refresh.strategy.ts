import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { hashRefreshToken } from '../../common/util/refresh-token';

// Fail closed: refuse to start without a configured refresh secret.
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_REFRESH_SECRET) throw new Error('JWT_REFRESH_SECRET is not set — refusing to start.');

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      secretOrKey: JWT_REFRESH_SECRET!, // guaranteed non-null by the startup guard above
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: { sub: string }) {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) throw new UnauthorizedException();
    // The presented token must match a live session row (one per device), not a
    // single shared column — so a sign-in on another device hasn't revoked it.
    const session = await this.prisma.refreshSession.findFirst({
      where: { userId: payload.sub, tokenHash: hashRefreshToken(refreshToken), expiresAt: { gt: new Date() } },
      include: { user: true },
    });
    if (!session) throw new UnauthorizedException();
    return session.user;
  }
}
