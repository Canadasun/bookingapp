import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import {
  squareAuthorizeUrl, squareExchangeCode, squareRefresh, squareRevoke, squareFetch,
} from './square-api';

// Per-merchant Square connection management (OAuth). Each business links their own
// Square account; client-payment API calls run on that account via these tokens.
// Mirrors the calendar-sync HMAC-signed-state pattern.
@Injectable()
export class SquareService {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  configured(): boolean {
    return !!(this.config.get('SQUARE_APPLICATION_ID') && this.config.get('SQUARE_APPLICATION_SECRET'));
  }

  private secret(): string {
    return this.config.get<string>('JWT_SECRET') ?? 'dev-secret';
  }

  // Signed OAuth state so the (public) callback can trust which business connected.
  private signState(businessId: string): string {
    const payload = Buffer.from(JSON.stringify({ b: businessId, t: Date.now() })).toString('base64url');
    const sig = createHmac('sha256', this.secret()).update(payload).digest('base64url');
    return `${payload}.${sig}`;
  }
  private verifyState(state: string): string | null {
    const [payload, sig] = (state ?? '').split('.');
    if (!payload || !sig) return null;
    const expect = createHmac('sha256', this.secret()).update(payload).digest('base64url');
    if (sig !== expect) return null;
    try {
      const { b, t } = JSON.parse(Buffer.from(payload, 'base64url').toString());
      if (Date.now() - t > 15 * 60_000) return null; // 15-minute window
      return b as string;
    } catch {
      return null;
    }
  }

  connectUrl(businessId: string): string {
    if (!this.configured()) throw new BadRequestException('Square is not configured on the server.');
    return squareAuthorizeUrl(this.signState(businessId));
  }

  // OAuth callback: exchange the code, pick the merchant's active location, store it.
  async handleCallback(code: string, state: string): Promise<{ businessId: string }> {
    const businessId = this.verifyState(state);
    if (!businessId) throw new BadRequestException('Invalid Square OAuth state');
    const tok = await squareExchangeCode(code);
    let locationId: string | null = null;
    let merchantName: string | null = null;
    try {
      const locs = await squareFetch<{ locations: any[] }>(tok.access_token, 'GET', '/v2/locations');
      const active = (locs.locations ?? []).find((l) => l.status === 'ACTIVE') ?? locs.locations?.[0];
      locationId = active?.id ?? null;
      merchantName = active?.business_name ?? active?.name ?? null;
    } catch {
      /* location is resolved lazily later if this fails */
    }
    const data = {
      merchantId: tok.merchant_id,
      accessToken: tok.access_token,
      refreshToken: tok.refresh_token,
      expiresAt: tok.expires_at ? new Date(tok.expires_at) : null,
      locationId,
      merchantName,
    };
    await this.prisma.squareConnection.upsert({
      where: { businessId },
      create: { businessId, ...data },
      update: data,
    });
    return { businessId };
  }

  async status(businessId: string) {
    const conn = await this.prisma.squareConnection.findUnique({ where: { businessId } });
    return {
      configured: this.configured(),
      connected: !!conn,
      merchantName: conn?.merchantName ?? null,
      locationId: conn?.locationId ?? null,
    };
  }

  async disconnect(businessId: string) {
    const conn = await this.prisma.squareConnection.findUnique({ where: { businessId } });
    if (conn) {
      await squareRevoke(conn.accessToken);
      await this.prisma.squareConnection.delete({ where: { businessId } });
    }
    return { disconnected: true };
  }

  // A valid (auto-refreshed) connection for a business, or a clear error. Refreshes
  // the access token when it's within 24h of expiry.
  async requireConnection(businessId: string) {
    const conn = await this.prisma.squareConnection.findUnique({ where: { businessId } });
    if (!conn) throw new BadRequestException('This business has not connected a Square account.');
    if (conn.expiresAt && conn.expiresAt.getTime() - Date.now() < 24 * 3600_000) {
      try {
        const tok = await squareRefresh(conn.refreshToken);
        return this.prisma.squareConnection.update({
          where: { businessId },
          data: {
            accessToken: tok.access_token,
            refreshToken: tok.refresh_token || conn.refreshToken,
            expiresAt: tok.expires_at ? new Date(tok.expires_at) : conn.expiresAt,
          },
        });
      } catch {
        /* fall through and try the existing token */
      }
    }
    return conn;
  }

  // The location id to charge against (resolve + cache if not stored yet).
  async locationId(businessId: string): Promise<string> {
    const conn = await this.requireConnection(businessId);
    if (conn.locationId) return conn.locationId;
    const locs = await squareFetch<{ locations: any[] }>(conn.accessToken, 'GET', '/v2/locations');
    const active = (locs.locations ?? []).find((l) => l.status === 'ACTIVE') ?? locs.locations?.[0];
    if (!active?.id) throw new BadRequestException('No Square location found for this account.');
    await this.prisma.squareConnection.update({ where: { businessId }, data: { locationId: active.id } });
    return active.id;
  }

  // Authenticated Square call on a business's merchant account.
  async merchantFetch<T = any>(businessId: string, method: string, path: string, body?: unknown): Promise<T> {
    const conn = await this.requireConnection(businessId);
    return squareFetch<T>(conn.accessToken, method, path, body);
  }

  // ── Platform account (Pulse's own Square) — used for SaaS subscription billing ──
  platformLocationId(): string {
    return this.config.get<string>('SQUARE_LOCATION_ID') ?? '';
  }

  // Authenticated Square call on the PLATFORM account (businesses pay Pulse here).
  async platformFetch<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const token = this.config.get<string>('SQUARE_ACCESS_TOKEN');
    if (!token) throw new BadRequestException('Square platform account is not configured (SQUARE_ACCESS_TOKEN).');
    return squareFetch<T>(token, method, path, body);
  }
}
