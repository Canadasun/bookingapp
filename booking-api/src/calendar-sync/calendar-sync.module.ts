import { Module } from '@nestjs/common';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarService } from './google-calendar.service';

@Module({
  controllers: [CalendarSyncController],
  providers: [CalendarSyncService, GoogleCalendarService],
  exports: [CalendarSyncService, GoogleCalendarService],
})
export class CalendarSyncModule {}
