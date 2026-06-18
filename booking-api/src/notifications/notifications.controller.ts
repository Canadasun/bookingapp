import { Controller, Get, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { verifyUnsubscribeToken } from './notifications.processor';

function unsubscribePage(message: string, success: boolean): string {
  const colour = success ? '#059669' : '#DC2626';
  const icon   = success ? '✓ Unsubscribed' : '⚠ Error';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Pulse — Unsubscribe</title>
<style>
  body{margin:0;padding:40px 16px;background:#F8F9FA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;text-align:center}
  .card{max-width:400px;margin:60px auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E5E7EB}
  h1{font-size:20px;font-weight:700;color:${colour};margin:0 0 12px}
  p{color:#6B7280;font-size:14px;margin:0;line-height:1.6}
</style></head>
<body><div class="card"><h1>${icon}</h1><p>${message}</p></div></body></html>`;
}

@Controller('notifications')
export class NotificationsController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  // One-click unsubscribe — linked from campaign email footers. No auth required;
  // authenticity is proved by an HMAC-SHA256 signature over the client ID.
  @Get('unsubscribe')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async unsubscribe(
    @Query('id')  clientId: string | undefined,
    @Query('sig') sig:      string | undefined,
    @Res() res: Response,
  ) {
    const secret = this.config.get<string>('JWT_SECRET') ?? '';

    if (!clientId || !sig || !verifyUnsubscribeToken(clientId, sig, secret)) {
      return res.status(400).send(unsubscribePage(
        'This unsubscribe link is invalid or has expired. Contact us if you need help.',
        false,
      ));
    }

    try {
      await this.prisma.client.update({
        where: { id: clientId },
        data: { marketingOptOut: true },
      });
    } catch {
      // P2025 — client record not found; treat as already unsubscribed.
      return res.send(unsubscribePage(
        'You are already unsubscribed and will no longer receive marketing emails.',
        true,
      ));
    }

    return res.send(unsubscribePage(
      'You have been unsubscribed and will no longer receive marketing emails from this business.',
      true,
    ));
  }
}
