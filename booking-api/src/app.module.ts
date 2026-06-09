import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { BusinessesModule } from './businesses/businesses.module';
import { StaffModule } from './staff/staff.module';
import { TasksModule } from './tasks/tasks.module';
import { ServiceDueModule } from './service-due/service-due.module';
import { ServicesModule } from './services/services.module';
import { ResourcesModule } from './resources/resources.module';
import { InvoicesModule } from './invoices/invoices.module';
import { LocationsModule } from './locations/locations.module';
import { AvailabilityModule } from './availability/availability.module';
import { BookingsModule } from './bookings/bookings.module';
import { ClientsModule } from './clients/clients.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadsModule } from './uploads/uploads.module';
import { InboxModule } from './inbox/inbox.module';
import { UsersModule } from './users/users.module';
import { MessagesModule } from './messages/messages.module';
import { OffersModule } from './offers/offers.module';
import { ClientPortalModule } from './client-portal/client-portal.module';
import { CalendarSyncModule } from './calendar-sync/calendar-sync.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { ReviewsModule } from './reviews/reviews.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { GiftCardsModule } from './gift-cards/gift-cards.module';
import { PackagesModule } from './packages/packages.module';
import { HealthModule } from './health/health.module';
import { EventsModule } from './events/events.module';
import { ReferralsModule } from './referrals/referrals.module';
import { VerificationModule } from './verification/verification.module';
import { SystemErrorsModule } from './system-errors/system-errors.module';
import { PromoCodesModule } from './promo-codes/promo-codes.module';
import { MembershipsModule } from './memberships/memberships.module';
import { RedisModule } from './common/redis/redis.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ZodValidationPipe } from './common/pipes/zod-validation.pipe';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
        genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
      },
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
    }),
    RedisModule,
    PrismaModule,
    AuthModule,
    UsersModule,
    BusinessesModule,
    StaffModule,
    TasksModule,
    ServiceDueModule,
    ServicesModule,
    ResourcesModule,
    InvoicesModule,
    LocationsModule,
    AvailabilityModule,
    BookingsModule,
    ClientsModule,
    NotificationsModule,
    PaymentsModule,
    UploadsModule,
    InboxModule,
    MessagesModule,
    OffersModule,
    ClientPortalModule,
    CalendarSyncModule,
    WaitlistModule,
    ReviewsModule,
    CampaignsModule,
    GiftCardsModule,
    PackagesModule,
    HealthModule,
    EventsModule,
    ReferralsModule,
    VerificationModule,
    SystemErrorsModule,
    PromoCodesModule,
    MembershipsModule,
  ],

  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_PIPE, useValue: new ZodValidationPipe() },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
