import { Controller, Get, Post, Param, Query, Res, UseGuards, ForbiddenException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarService } from './google-calendar.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };

@ApiTags('calendar-sync')
@Controller('calendar-sync')
export class CalendarSyncController {
  constructor(
    private readonly calendarSyncService: CalendarSyncService,
    private readonly google: GoogleCalendarService,
  ) {}

  // ── Google Calendar OAuth ───────────────────────────────────────────────────
  // Owner — get the consent URL to connect their Google Calendar.
  @Get('google/connect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  connect(@CurrentUser() user: AuthUser) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return { url: this.google.authUrl(user.businessId) };
  }

  // Public — Google redirects here after consent. Verifies the signed state,
  // stores the connection, and bounces back to the dashboard.
  @Get('google/callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') oauthError: string,
    @Res() res: Response,
  ) {
    const web = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    const logger = new Logger('GoogleCallback');
    try {
      if (oauthError) throw new Error(`google_denied:${oauthError}`); // e.g. access_denied
      if (!code) throw new Error('missing_code');
      await this.google.handleCallback(code, state);
      logger.log('Google Calendar connected successfully');
      return res.redirect(`${web}/dashboard/settings?calendar=connected`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      logger.warn(`Google callback FAILED: ${reason}`);
      return res.redirect(`${web}/dashboard/settings?calendar=error&reason=${encodeURIComponent(reason)}`);
    }
  }

  @Get('google/status')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  status(@CurrentUser() user: AuthUser) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.google.status(user.businessId);
  }

  @Post('google/disconnect')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  disconnect(@CurrentUser() user: AuthUser) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    return this.google.disconnect(user.businessId);
  }

  // Owner — manually (re)sync one appointment to Google.
  @Post(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  async sync(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.calendarSyncService.syncAppointment(id, user);
    await this.google.syncAppointment(id);
    return { success: true };
  }
}
