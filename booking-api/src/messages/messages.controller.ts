import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException, Headers, HttpCode, Header, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const twilio = require('twilio') as typeof import('twilio');
import { z } from 'zod';
import { MessagesService } from './messages.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { verifyAppointmentToken } from '../common/util/appointment-token';

const SendSchema = z.object({ content: z.string().min(1).max(2000) });
type SendDto = z.infer<typeof SendSchema>;
type BusinessUser = { id: string; role: string; businessId: string | null };

async function assertBusinessThreadAccess(svc: MessagesService, user: BusinessUser, businessId: string, clientId: string) {
  try {
    await svc.assertBusinessUserCanAccessClient(user, businessId, clientId);
  } catch {
    throw new ForbiddenException('You do not have access to this thread');
  }
}

@ApiTags('messages')
@Controller('businesses/:businessId/clients/:clientId/messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  // Protected or Public-with-token — reads thread
  // Token is accepted only via x-manage-token so it cannot leak through URLs.
  @Get()
  @ApiBearerAuth()
  @UseGuards(OptionalJwtAuthGuard)
  async thread(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Query('appointmentId') appointmentId?: string,
    @Headers('x-manage-token') headerToken?: string,
    @CurrentUser() user?: { id: string; role: string; businessId: string | null },
  ) {
    const token = headerToken;
    if (user && user.role !== 'CLIENT') {
      await assertBusinessThreadAccess(this.svc, user, businessId, clientId);
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
  // Secured by appointment token for guests; token in header (not URL) to avoid logs.
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  async clientSend(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(SendSchema)) dto: SendDto,
    @Query('appointmentId') appointmentId?: string,
    @Headers('x-manage-token') headerToken?: string,
    @CurrentUser() user?: { id: string; role: string },
  ) {
    const token = headerToken;
    // 1. If logged in as a client, verify it's their own clientId
    if (user && user.role === 'CLIENT') {
      const ok = await this.svc.verifyUserClient(user.id, businessId, clientId);
      if (!ok) throw new ForbiddenException('You do not have access to this client profile');
    }

    // This route represents a message sent by the client. Business users must use
    // /reply; otherwise an authenticated user from another tenant could forge a
    // client-authored message without presenting an appointment manage token.
    if (user && user.role !== 'CLIENT') {
      throw new ForbiddenException('Business users must use the reply endpoint');
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
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async staffReply(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(SendSchema)) dto: SendDto,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    await assertBusinessThreadAccess(this.svc, user, businessId, clientId);

    const msg = await this.svc.send(businessId, clientId, dto.content, false);
    // FREE: in-app only — no SMS outreach.
    // BASIC: SMS reply only when the client texted first.
    // PRO/UNLIMITED: can initiate SMS to any client with a prior booking.
    const biz = await this.svc.getBusiness(businessId);
    let sms: { sent: boolean; reason?: string } = { sent: false, reason: 'plan_not_eligible' };
    if (biz && biz.plan !== 'FREE') {
      const smsPlan = (biz.plan === 'UNLIMITED' ? 'PRO' : biz.plan) as 'BASIC' | 'PRO';
      sms = await this.svc.maybeSendReplySms(businessId, clientId, dto.content, smsPlan);
    }
    return { ...msg, sms };
  }

  // Protected — mark messages as read
  @Patch('read')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async markRead(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    await assertBusinessThreadAccess(this.svc, user, businessId, clientId);
    return this.svc.markRead(businessId, clientId, user.id, user);
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
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
    @Query('unread') unread?: string,
    @Query('archived') archived?: string,
    @Query('search') search?: string,
    @Query('channel') channel?: string,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    const VALID_CHANNELS = ['IN_APP', 'SMS'];
    const safeChannel = channel && VALID_CHANNELS.includes(channel) ? channel : undefined;
    return this.svc.getBusinessThreads(businessId, user, { unreadOnly: unread === 'true', archived: archived === 'true', search: search?.slice(0, 100), channel: safeChannel });
  }

  @Get('unread-count')
  unreadCount(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.svc.getUnreadCount(businessId, user.id, user);
  }

  @Patch(':clientId/archive')
  async archive(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Body() body: { archived?: boolean },
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    await assertBusinessThreadAccess(this.svc, user, businessId, clientId);
    return this.svc.setArchived(businessId, clientId, user.id, body.archived !== false);
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
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      throw new ServiceUnavailableException('Twilio webhook verification is not configured');
    }
    const base = (process.env.API_PUBLIC_URL ?? '').replace(/\/+$/, '').replace(/\/api$/, '');
    if (!base) {
      throw new ServiceUnavailableException('API_PUBLIC_URL is required for Twilio webhook verification');
    }
    const url = `${base}/api/messages/sms/inbound`;
    if (!twilio.validateRequest(authToken, sig ?? '', url, body ?? {})) {
      throw new ForbiddenException('Invalid Twilio signature');
    }
    await this.svc.handleInboundSms(String(body?.From ?? ''), String(body?.Body ?? ''));
    // Empty TwiML — we handle the reply in-app, so Twilio shouldn't auto-respond.
    return '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
  }
}
