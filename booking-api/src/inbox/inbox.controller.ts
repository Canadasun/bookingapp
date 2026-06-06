import { Controller, Delete, Get, Post, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { InboxService } from './inbox.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

// In-app notification inbox for the signed-in user.
@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class InboxController {
  constructor(private inbox: InboxService) {}

  @Get()
  list(@CurrentUser() user: User) {
    return this.inbox.list(user.id);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: User) {
    return { count: await this.inbox.unreadCount(user.id) };
  }

  @Get('deliveries')
  deliveries(
    @CurrentUser() user: User,
    @Query('status') status?: string,
    @Query('channel') channel?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inbox.deliveryLogs(user, {
      status,
      channel,
      search,
      limit: limit ? Number.parseInt(limit, 10) : undefined,
    });
  }

  @Post('read-all')
  readAll(@CurrentUser() user: User) {
    return this.inbox.markAllRead(user.id);
  }

  @Delete()
  clear(@CurrentUser() user: User) {
    return this.inbox.clear(user.id);
  }

  @Post(':id/read')
  read(@Param('id') id: string, @CurrentUser() user: User) {
    return this.inbox.markRead(user.id, id);
  }
}
