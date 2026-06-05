import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException, Headers, HttpCode, Header } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require('twilio') as typeof import('twilio');
import { z } from 'zod';
import { MessagesService } from './messages.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { effectivePlan } from '../common/util/plan';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { verifyAppointmentToken } from '../common/util/appointment-token';

const SendSchema = z.object({ content: z.string().min(1).max(2000) });
type SendDto = z.infer<typeof SendSchema>;

@ApiTags('messages')
@Controller('businesses/:businessId/clients/:clientId/messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  // Protected or Public-with-token — reads thread
  @Get()
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async thread(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Query('appointmentId') appointmentId?: string,
    @Query('token') token?: string,
    @CurrentUser() user?: { id: string; role: string; businessId: string | null },
  ) {
    if (user && (user.role === 'ADMIN' || user.businessId === businessId)) {
      return this.svc.getThread(businessId, clientId);
    }

    if (user && user.role === 'CLIENT') {
      const ok = await this.svc.verifyUserClient(user.id, businessId, clientId);
      if (ok) return this.svc.getThread(businessId, clientId);
    }

    if (appointmentId && token && verifyAppointmentToken(appointmentId, token)) {
      const ok = await this.svc.verifyAppointmentClient(appointmentId, businessId, clientId);
      if (ok) return this.svc.getThread(businessId, clientId);
    }

    throw new ForbiddenException('You do not have access to this thread');
  }

  // Public — client sends message from manage page or mobile
  // Secured by appointment token for guests
  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  async clientSend(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(SendSchema)) dto: SendDto,
    @Query('appointmentId') appointmentId?: string,
    @Query('token') token?: string,
    @CurrentUser() user?: { id: string; role: string },
  ) {
    // 1. If logged in as a client, verify it's their own clientId
    if (user && user.role === 'CLIENT') {
      const ok = await this.svc.verifyUserClient(user.id, businessId, clientId);
      if (!ok) throw new ForbiddenException('You do not have access to this client profile');
    }

    // 2. If guest, require valid appointment token
    if (!user) {
      if (!appointmentId || !token || !verifyAppointmentToken(appointmentId, token)) {
        throw new ForbiddenException('Valid appointment token required to message as a guest');
      }
      const ok = await this.svc.verifyAppointmentClient(appointmentId, businessId, clientId);
      if (!ok) throw new ForbiddenException('Token does not match this client');
    }

    return this.svc.send(businessId, clientId, dto.content, true);
  }

  // Protected — staff replies
  @Post('reply')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async staffReply(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(SendSchema)) dto: SendDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }

    // Free: receive only (no replies). Basic/Pro can reply in-app, and — for
    // clients who texted first (Basic) or who have a booking (Pro) — by SMS too.
    const biz = await this.svc.getBusiness(businessId);
    const tier = effectivePlan(biz?.plan);
    if (tier === 'FREE') {
      throw new ForbiddenException('Replying to clients is a paid-plan feature. Please upgrade to Basic or Pro.');
    }

    const msg = await this.svc.send(businessId, clientId, dto.content, false);
    const sms = await this.svc.maybeSendReplySms(businessId, clientId, dto.content, tier as 'BASIC' | 'PRO');
    return { ...msg, sms };
  }

  // Protected — mark messages as read
  @Patch('read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  markRead(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.svc.markRead(businessId, clientId);
  }
}

// Separate controller for getting all unread threads for a business
@ApiTags('messages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/messages')
export class BusinessMessagesController {
  constructor(private svc: MessagesService) {}

  @Get()
  threads(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Query('unread') unread?: string,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.svc.getBusinessThreads(businessId, unread === 'true');
  }
}

// ── Public Twilio inbound-SMS webhook ────────────────────────────────────────
// Configure this URL on your Twilio number's "A message comes in" webhook:
//   https://<api-domain>/api/messages/sms/inbound  (HTTP POST)
@ApiTags('messages')
@Controller('messages/sms')
export class SmsWebhookController {
  constructor(private svc: MessagesService) {}

  @Post('inbound')
  @HttpCode(200)
  @Header('Content-Type', 'text/xml')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async inbound(@Headers('x-twilio-signature') sig: string, @Body() body: Record<string, string>) {
    const authToken = process.env.TWILIO_AUTH_TOKEN ?? process.env.TWILIO_API_CLIENT_SECRET;
    // Verify the request really came from Twilio (skipped only in stub/dev where
    // no real token is set). The URL must match the configured webhook exactly.
    if (authToken && !authToken.startsWith('AC_placeholder')) {
      const base = (process.env.API_PUBLIC_URL ?? 'https://bookingapp-production-32f8.up.railway.app').replace(/\/+$/, '').replace(/\/api$/, '');
      const url = `${base}/api/messages/sms/inbound`;
      if (!twilio.validateRequest(authToken, sig ?? '', url, body ?? {})) {
        throw new ForbiddenException('Invalid Twilio signature');
      }
    }
    await this.svc.handleInboundSms(String(body?.From ?? ''), String(body?.Body ?? ''));
    // Empty TwiML — we handle the reply in-app, so Twilio shouldn't auto-respond.
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
}
