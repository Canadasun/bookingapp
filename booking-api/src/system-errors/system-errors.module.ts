import { Module } from '@nestjs/common';
import { SystemErrorsService } from './system-errors.service';
import { SystemErrorsController } from './system-errors.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SystemErrorsController],
  providers: [SystemErrorsService],
  exports: [SystemErrorsService],
})
export class SystemErrorsModule {}
