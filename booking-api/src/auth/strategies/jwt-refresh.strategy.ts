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
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    // Compare the hash of the presented token against the stored hash.
    if (!user || !user.refreshToken || user.refreshToken !== hashRefreshToken(refreshToken)) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
