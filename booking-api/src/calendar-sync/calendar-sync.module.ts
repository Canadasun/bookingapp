import { Module } from '@nestjs/common';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarService } from './google-calendar.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CalendarSyncController],
  providers: [CalendarSyncService, GoogleCalendarService],
  exports: [CalendarSyncService, GoogleCalendarService],
})
export class CalendarSyncModule {}
