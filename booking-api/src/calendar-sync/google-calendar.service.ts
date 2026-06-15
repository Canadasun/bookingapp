import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { decryptProviderToken, encryptProviderToken } from '../common/util/provider-token-crypto';

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const CAL_API = 'https://www.googleapis.com/calendar/v3';
// calendar.events: create/update/delete events on the user's calendars.
const SCOPE = 'https://www.googleapis.com/auth/calendar.events openid email';

@Injectable()
export class GoogleCalendarService {
  private readonly logger = new Logger(GoogleCalendarService.name);

  constructor(private prisma: PrismaService, private redis: RedisService) {}

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

  private async createState(businessId: string, userId: string): Promise<string> {
    const state = randomBytes(32).toString('base64url');
    const stored = await this.redis.client.set(
      `oauth:google:${state}`,
      JSON.stringify({ businessId, userId }),
      'EX', 15 * 60,
      'NX',
    );
    if (stored !== 'OK') throw new BadRequestException('Unable to start Google authorization');
    return state;
  }

  private async consumeState(state: string, browserState: string): Promise<{ businessId: string; userId: string }> {
    if (!state || !browserState || state !== browserState) {
      throw new BadRequestException('Invalid or expired OAuth state.');
    }
    const raw = await this.redis.client.getdel(`oauth:google:${state}`);
    if (!raw) throw new BadRequestException('Invalid or expired OAuth state.');
    try {
      const parsed = JSON.parse(raw) as { businessId?: string; userId?: string };
      if (!parsed.businessId || !parsed.userId) throw new Error('invalid state');
      return { businessId: parsed.businessId, userId: parsed.userId };
    } catch {
      throw new BadRequestException('Invalid or expired OAuth state.');
    }
  }

  // ── OAuth flow ─────────────────────────────────────────────────────────────
  async authUrl(businessId: string, userId: string): Promise<{ url: string; state: string }> {
    if (!this.configured()) throw new BadRequestException('Google Calendar is not configured on the server.');
    const state = await this.createState(businessId, userId);
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.redirectUri(),
      response_type: 'code',
      scope: SCOPE,
      access_type: 'offline',
      prompt: 'consent',          // force a refresh_token every time
      include_granted_scopes: 'true',
      state,
    });
    return { url: `${AUTH_URL}?${params.toString()}`, state };
  }

  // Exchange the callback code for tokens and persist the connection.
  async handleCallback(code: string, state: string, browserState: string): Promise<{ businessId: string }> {
    const { businessId } = await this.consumeState(state, browserState);

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
      await tokenRes.body?.cancel().catch(() => undefined);
      this.logger.warn(`Google token exchange failed with status ${tokenRes.status}`);
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
      update: { accessToken: encryptProviderToken(tok.access_token), expiresAt, ...(tok.refresh_token ? { refreshToken: encryptProviderToken(tok.refresh_token) } : {}), ...(email ? { email } : {}) },
      create: { businessId, accessToken: encryptProviderToken(tok.access_token), expiresAt, refreshToken: encryptProviderToken(tok.refresh_token!), email },
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
      return { token: decryptProviderToken(conn.accessToken), calendarId: conn.calendarId };
    }
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId(),
        client_secret: this.clientSecret(),
        refresh_token: decryptProviderToken(conn.refreshToken),
        grant_type: 'refresh_token',
      }),
    });
    if (!res.ok) { this.logger.warn(`Google token refresh failed for ${businessId}`); return null; }
    const tok = await res.json() as { access_token: string; expires_in: number };
    const expiresAt = new Date(Date.now() + (tok.expires_in - 60) * 1000);
    await this.prisma.googleCalendarConnection.update({
      where: { businessId },
      data: {
        accessToken: encryptProviderToken(tok.access_token),
        refreshToken: encryptProviderToken(decryptProviderToken(conn.refreshToken)),
        expiresAt,
      },
    });
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
