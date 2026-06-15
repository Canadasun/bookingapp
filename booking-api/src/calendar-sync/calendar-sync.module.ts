import { Module } from '@nestjs/common';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';
import { GoogleCalendarService } from './google-calendar.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [CalendarSyncController],
  providers: [CalendarSyncService, GoogleCalendarService],
  exports: [CalendarSyncService, GoogleCalendarService],
})
export class CalendarSyncModule {}
