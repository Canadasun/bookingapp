import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { CalendarSyncService } from './calendar-sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('calendar-sync')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.OWNER, Role.ADMIN)
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
