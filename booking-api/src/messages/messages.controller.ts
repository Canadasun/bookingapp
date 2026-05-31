import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { MessagesService } from './messages.service';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const SendSchema = z.object({ content: z.string().min(1).max(2000) });
type SendDto = z.infer<typeof SendSchema>;

@ApiTags('messages')
@Controller('businesses/:businessId/clients/:clientId/messages')
export class MessagesController {
  constructor(private svc: MessagesService) {}

  // Protected — staff/owner reads thread
  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  thread(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.svc.getThread(businessId, clientId);
  }

  // Public — client sends message from manage page or mobile
  @Post()
  clientSend(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(SendSchema)) dto: SendDto,
  ) {
    return this.svc.send(businessId, clientId, dto.content, true);
  }

  // Protected — staff replies
  @Post('reply')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  staffReply(
    @Param('businessId') businessId: string,
    @Param('clientId') clientId: string,
    @Body(new ZodValidationPipe(SendSchema)) dto: SendDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.svc.send(businessId, clientId, dto.content, false);
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
