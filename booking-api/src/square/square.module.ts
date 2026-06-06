import { Module } from '@nestjs/common';
import { SquareService } from './square.service';
import { SquareController } from './square.controller';

// Per-merchant Square connection (OAuth) + low-level API access. Exported so
// PaymentsModule can run client charges on each business's Square account.
@Module({
  providers: [SquareService],
  controllers: [SquareController],
  exports: [SquareService],
})
export class SquareModule {}
