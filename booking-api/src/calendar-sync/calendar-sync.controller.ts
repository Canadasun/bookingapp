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
import { PrismaService } from '../prisma/prisma.service';
import { generateICalFeed } from './ical.util';

type AuthUser = { id: string; role: string; businessId: string | null };

@ApiTags('calendar-sync')
@Controller('calendar-sync')
export class CalendarSyncController {
  // In-memory record of the last OAuth callback outcome (diagnostics — survives
  // within the running process; readable via google/last-attempt).
  private static lastAttempt: { at: string; ok: boolean; reason?: string; query?: string } | null = null;

  constructor(
    private readonly calendarSyncService: CalendarSyncService,
    private readonly google: GoogleCalendarService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('google/last-attempt')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  lastAttempt() {
    return CalendarSyncController.lastAttempt ?? { at: null, ok: null, reason: 'no callback received yet' };
  }

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
    @Query('iss') iss: string,
    @Res() res: Response,
  ) {
    // Use a hard-coded production fallback so a missing env var doesn't redirect
    // the user to localhost. NEXT_PUBLIC_WEB_URL must be set on the API service.
    const web = (process.env.NEXT_PUBLIC_WEB_URL ?? 'https://pulseappointments.com').replace(/\/$/, '');
    const logger = new Logger('GoogleCallback');

    // Google OIDC issuer hint — a protocol probe sent before the real callback
    // that carries only ?iss= (no code, no error). Acknowledge silently; the
    // actual callback with code= arrives in a separate request.
    if (iss && !code && !oauthError) {
      logger.log('Google OIDC issuer probe received — no action needed');
      return res.status(200).send('OK');
    }

    const queryInfo = `code=${code ? 'yes' : 'no'} error=${oauthError ?? 'none'} state=${state ? 'yes' : 'no'}`;
    try {
      if (oauthError) throw new Error(`google_denied:${oauthError}`); // e.g. access_denied
      if (!code) throw new Error('missing_code');
      await this.google.handleCallback(code, state);
      logger.log('Google Calendar connected successfully');
      CalendarSyncController.lastAttempt = { at: new Date().toISOString(), ok: true, query: queryInfo };
      return res.redirect(`${web}/dashboard/settings?tab=calendar&calendar=connected`);
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'unknown';
      logger.warn(`Google callback FAILED: ${reason}`);
      CalendarSyncController.lastAttempt = { at: new Date().toISOString(), ok: false, reason, query: queryInfo };
      // Map raw error messages to safe codes so internal detail never appears in the browser URL.
      const safeCode = reason.startsWith('google_denied') ? 'denied'
        : reason === 'missing_code' ? 'missing_code'
        : 'error';
      return res.redirect(`${web}/dashboard/settings?tab=calendar&calendar=error&reason=${safeCode}`);
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
    return this.calendarSyncService.syncAppointment(id, user);
  }

  // Owner — download/subscribe to an iCal feed of all their appointments.
  // Works even without Google Calendar connected; subscribe via webcal:// in any calendar app.
  @Get('ical/feed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  async icalFeed(@CurrentUser() user: AuthUser, @Res() res: Response) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    const business = await this.prisma.business.findUnique({ where: { id: user.businessId }, select: { name: true } });
    const apts = await this.prisma.appointment.findMany({
      where: {
        businessId: user.businessId,
        status: { in: ['CONFIRMED', 'PENDING', 'COMPLETED'] },
        startsAt: { gte: new Date(Date.now() - 90 * 86_400_000) }, // last 90 days + future
      },
      include: {
        service: { select: { name: true } },
        client: { select: { name: true } },
        staff: { include: { user: { select: { name: true } } } },
      },
      orderBy: { startsAt: 'asc' },
      take: 500,
    });
    const ical = generateICalFeed(apts, `${business?.name ?? 'Pulse'} Appointments`);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="pulse-appointments.ics"');
    res.send(ical);
  }
}
