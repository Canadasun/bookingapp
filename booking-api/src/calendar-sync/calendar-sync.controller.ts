import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { CalendarSyncService } from './calendar-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('calendar-sync')
@UseGuards(JwtAuthGuard)
export class CalendarSyncController {
  constructor(private readonly calendarSyncService: CalendarSyncService) {}

  @Post(':id')
  sync(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: string; businessId: string | null },
  ) {
    return this.calendarSyncService.syncAppointment(id, user);
  }
}
