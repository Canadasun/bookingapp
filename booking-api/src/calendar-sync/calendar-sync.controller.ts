import { Controller, Get, Post, Param, Query, Res, UseGuards, ForbiddenException } from '@nestjs/common';
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
  async callback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    const web = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
    try {
      if (!code) throw new Error('missing code');
      await this.google.handleCallback(code, state);
      return res.redirect(`${web}/dashboard/settings?calendar=connected`);
    } catch {
      return res.redirect(`${web}/dashboard/settings?calendar=error`);
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
