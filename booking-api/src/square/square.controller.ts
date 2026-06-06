import { Controller, Get, Post, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { SquareService } from './square.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@ApiTags('square')
@ApiBearerAuth()
@Controller('square')
export class SquareController {
  constructor(private square: SquareService, private config: ConfigService) {}

  // Owner: get the URL to connect their Square account.
  @Get('connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  connect(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return { url: this.square.connectUrl(user.businessId) };
  }

  // Public — Square redirects here after the merchant authorizes. Trust is
  // established by the HMAC-signed `state`, not auth.
  @Get('oauth/callback')
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const webUrl = this.config.get<string>('NEXT_PUBLIC_WEB_URL') ?? 'http://localhost:3000';
    try {
      if (!code) throw new Error('missing code');
      await this.square.handleCallback(code, state);
      return res.redirect(`${webUrl}/dashboard/settings?square=connected`);
    } catch {
      return res.redirect(`${webUrl}/dashboard/settings?square=error`);
    }
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  status(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.square.status(user.businessId);
  }

  @Post('disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  disconnect(@CurrentUser() user: { businessId: string | null }) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.square.disconnect(user.businessId);
  }
}
