import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AvailabilityService } from './availability.service';
import { GetSlotsSchema, GetSlotsDto } from './dto/availability.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';

@ApiTags('availability')
@Controller('availability')
export class AvailabilityController {
  constructor(private availabilityService: AvailabilityService) {}

  @Get('slots')
  getSlots(@Query(new ZodValidationPipe(GetSlotsSchema)) dto: GetSlotsDto) {
    return this.availabilityService.getAvailableSlots(dto);
  }
}
