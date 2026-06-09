import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SystemErrorsService } from './system-errors.service';
import { SystemErrorsController } from './system-errors.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [SystemErrorsController],
  providers: [SystemErrorsService],
  exports: [SystemErrorsService],
})
export class SystemErrorsModule {}
