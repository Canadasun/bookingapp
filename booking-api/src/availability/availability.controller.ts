import { Controller, Get, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AvailabilityService } from './availability.service';
import { GetSlotsSchema, GetSlotsDto } from './dto/availability.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('slots')
  getSlots(
    @Query(new ZodValidationPipe(GetSlotsSchema)) dto: GetSlotsDto,
    @Req() req: Request,
  ) {
    const isAuthenticated = !!(req.headers['authorization']);
    if (!isAuthenticated && dto.enforceNotice === 'false') {
      dto = { ...dto, enforceNotice: undefined };
    }
    return this.availabilityService.getAvailableSlots(dto);
  }
}
