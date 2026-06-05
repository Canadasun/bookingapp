import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CAL_API = 'https://www.googleapis.com/calendar/v3';
// calendar.events: create/update/delete events on the user's calendars.
const SCOPE = 'https://www.googleapis.com/auth/calendar.events openid email';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private prisma: PrismaService) {}

  private clientId() { return process.env.GOOGLE_CLIENT_ID ?? ''; }
  private clientSecret() { return process.env.GOOGLE_CLIENT_SECRET ?? ''; }
  private redirectUri() {
    const configured = process.env.GOOGLE_REDIRECT_URI;
    if (configured && !(process.env.NODE_ENV === 'production' && /localhost|127\.0\.0\.1/.test(configured))) {
      return configured;
    }
    const publicApi =
      process.env.API_PUBLIC_URL
      ?? (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : undefined);
    return publicApi
      ? `${publicApi.replace(/\/+$/, '').replace(/\/api$/, '')}/api/calendar-sync/google/callback`
      : 'https://bookingapp-production-32f8.up.railway.app/api/calendar-sync/google/callback';
  }
  configured() { return !!this.clientId() && !!this.clientSecret(); }

  // ── Signed state (so the OAuth callback can't be forged) ───────────────────
  private signState(businessId: string): string {
    const payload = Buffer.from(JSON.stringify({ b: businessId, t: Date.now() })).toString('base64url');
    const sig = createHmac('sha256', process.env.JWT_SECRET ?? '').update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }
  private verifyState(state: string): string | null {
    const [payload, sig] = (state ?? '').split('.');
    if (!payload || !sig) return null;
    const expected = createHmac('sha256', process.env.JWT_SECRET ?? '').update(payload).digest('base64url');
    if (sig !== expected) return null;
    try {
      const { b, t } = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (Date.now() - t > 15 * 60 * 1000) return null; // 15-minute window
      return b as string;
    } catch { return null; }
  }

  // ── OAuth flow ─────────────────────────────────────────────────────────────
  authUrl(businessId: string): string {
    if (!this.configured()) throw new BadRequestException('Google Calendar is not configured on the server.');
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',          // force a refresh_token every time
      include_granted_scopes: 'true',
      state: this.signState(businessId),
    });
    return `${AUTH_URL}?${params.toString()}`;
  }

  // Exchange the callback code for tokens and persist the connection.
  async handleCallback(code: string, state: string): Promise<{ businessId: string }> {
    const businessId = this.verifyState(state);
    if (!businessId) throw new BadRequestException('Invalid or expired OAuth state.');

    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        redirect_uri: this.redirectUri(),
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) {
      const body = await tokenRes.text().catch(() => '');
      this.logger.warn(`token exchange ${tokenRes.status}: ${body.slice(0, 300)}`);
      throw new BadRequestException(`token_exchange_${tokenRes.status}`);
    }
    const tok = await tokenRes.json() as { access_token: string; refresh_token?: string; expires_in: number };
    if (!tok.refresh_token) {
      // No refresh token (already granted previously) — keep any existing one.
      const existing = await this.prisma.googleCalendarConnection.findUnique({ where: { businessId } });
      if (!existing) throw new BadRequestException('no_refresh_token');
    }

    let email: string | undefined;
    try {
      const info = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tok.access_token}` } });
      if (info.ok) email = ((await info.json()) as { email?: string }).email;
    } catch { /* email is a nice-to-have */ }

    const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000);
    await this.prisma.googleCalendarConnection.upsert({
      where: { businessId },
      update: { accessToken: tok.access_token, expiresAt, ...(tok.refresh_token ? { refreshToken: tok.refresh_token } : {}), ...(email ? { email } : {}) },
      create: { businessId, accessToken: tok.access_token, expiresAt, refreshToken: tok.refresh_token!, email },
    });
    return { businessId };
  }

  async status(businessId: string) {
    const conn = await this.prisma.googleCalendarConnection.findUnique({
      where: { businessId }, select: { email: true, createdAt: true },
    });
    return { connected: !!conn, email: conn?.email ?? null, since: conn?.createdAt ?? null, configured: this.configured() };
  }

  async disconnect(businessId: string) {
    await this.prisma.googleCalendarConnection.deleteMany({ where: { businessId } });
    return { ok: true };
  }

  // Return a valid access token, refreshing via the stored refresh_token if needed.
  private async accessTokenFor(businessId: string): Promise<{ token: string; calendarId: string } | null> {
    const conn = await this.prisma.googleCalendarConnection.findUnique({ where: { businessId } });
    if (!conn) return null;
    if (conn.accessToken && conn.expiresAt && conn.expiresAt > new Date()) {
      return { token: conn.accessToken, calendarId: conn.calendarId };
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        refresh_token: conn.refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) { this.logger.warn(`Google token refresh failed for ${businessId}`); return null; }
    const tok = await res.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000);
    await this.prisma.googleCalendarConnection.update({ where: { businessId }, data: { accessToken: tok.access_token, expiresAt } });
    return { token: tok.access_token, calendarId: conn.calendarId };
  }

  // Busy time ranges from the connected Google Calendar over [timeMin, timeMax],
  // so the booking flow can hide slots when the owner has a personal event.
  // Best-effort: returns [] when not connected or on any error (never blocks
  // availability). All-day and "free"/cancelled events are ignored.
  async busyIntervals(businessId: string, timeMinISO: string, timeMaxISO: string): Promise<{ start: Date; end: Date }[]> {
    try {
      const auth = await this.accessTokenFor(businessId);
      if (!auth) return [];
      const params = new URLSearchParams({
        timeMin: timeMinISO,
        timeMax: timeMaxISO,
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
        fields: 'items(start,end,status,transparency)',
      });
      const res = await fetch(`${CAL_API}/calendars/${encodeURIComponent(auth.calendarId)}/events?${params.toString()}`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) return [];
      const data = await res.json() as {
        items?: Array<{ start?: { dateTime?: string }; end?: { dateTime?: string }; status?: string; transparency?: string }>;
      };
      const out: { start: Date; end: Date }[] = [];
      for (const ev of data.items ?? []) {
        if (ev.status === 'cancelled' || ev.transparency === 'transparent') continue;
        const s = ev.start?.dateTime; const e = ev.end?.dateTime;
        if (!s || !e) continue; // skip all-day (date-only) events
        out.push({ start: new Date(s), end: new Date(e) });
      }
      return out;
    } catch (e) {
      this.logger.warn(`Google busy fetch failed for ${businessId}: ${e}`);
      return [];
    }
  }

  // ── Event sync (best-effort — never throws into the booking flow) ──────────
  async syncAppointment(appointmentId: string): Promise<void> {
    try {
      const apt = await this.prisma.appointment.findUnique({
        where: { id: appointmentId },
        include: { service: true, client: true, business: true },
      });
      if (!apt) return;
      const auth = await this.accessTokenFor(apt.businessId);
      if (!auth) return; // business hasn't connected Google
      const tz = apt.business.timezone ?? 'UTC';
      const body = {
        summary: `${apt.service.name} — ${apt.client.name}`,
        description: `Booked via Pulse${apt.notes ? `\n\nNotes: ${apt.notes}` : ''}`,
        start: { dateTime: apt.startsAt.toISOString(), timeZone: tz },
        end: { dateTime: apt.endsAt.toISOString(), timeZone: tz },
        ...(apt.client.email ? { attendees: [{ email: apt.client.email, responseStatus: 'accepted' }] } : {}),
      };
      const base = `${CAL_API}/calendars/${encodeURIComponent(auth.calendarId)}/events`;
      if (apt.googleEventId) {
        const res = await fetch(`${base}/${apt.googleEventId}`, {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) this.logger.warn(`Google event patch failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
      } else {
        const res = await fetch(base, {
          method: 'POST',
          headers: { Authorization: `Bearer ${auth.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (res.ok) {
          const ev = await res.json() as { id: string };
          await this.prisma.appointment.update({ where: { id: appointmentId }, data: { googleEventId: ev.id } });
        } else {
          this.logger.warn(`Google event insert failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
        }
      }
    } catch (e) { this.logger.warn(`Google sync failed for ${appointmentId}: ${e}`); }
  }

  async removeAppointment(appointmentId: string): Promise<void> {
    try {
      const apt = await this.prisma.appointment.findUnique({
        where: { id: appointmentId }, select: { businessId: true, googleEventId: true },
      });
      if (!apt?.googleEventId) return;
      const auth = await this.accessTokenFor(apt.businessId);
      if (!auth) return;
      await fetch(`${CAL_API}/calendars/${encodeURIComponent(auth.calendarId)}/events/${apt.googleEventId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      await this.prisma.appointment.update({ where: { id: appointmentId }, data: { googleEventId: null } });
    } catch (e) { this.logger.warn(`Google remove failed for ${appointmentId}: ${e}`); }
  }
}
