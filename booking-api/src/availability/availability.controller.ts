import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AvailabilityService } from './availability.service';
import { GetSlotsSchema, GetSlotsDto } from './dto/availability.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @UseGuards(OptionalJwtAuthGuard)
  @Get('slots')
  getSlots(
    @Query(new ZodValidationPipe(GetSlotsSchema)) dto: GetSlotsDto,
    @CurrentUser() user: { id: string } | null,
  ) {
    // Only a verified authenticated user may bypass the min-notice window.
    // Previously checked header presence alone, which any caller could fake.
    if (!user && dto.enforceNotice === 'false') {
      dto = { ...dto, enforceNotice: undefined };
    }
    return this.availabilityService.getAvailableSlots(dto);
  }
}
