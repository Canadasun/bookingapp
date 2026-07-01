import { Module } from '@nestjs/common';
import { MigrationsController } from './migrations.controller';
import { MigrationsService } from './migrations.service';
import { PublicMigrationLeadsController, AdminMigrationLeadsController } from './migration-leads.controller';
import { MigrationLeadsService } from './migration-leads.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [MigrationsController, PublicMigrationLeadsController, AdminMigrationLeadsController],
  providers: [MigrationsService, MigrationLeadsService],
})
export class MigrationsModule {}
