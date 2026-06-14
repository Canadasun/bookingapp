import { Module } from '@nestjs/common';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';
import { PaymentsModule } from '../payments/payments.module';

@Module({ imports: [PaymentsModule], controllers: [MembershipsController], providers: [MembershipsService] })
export class MembershipsModule {}
