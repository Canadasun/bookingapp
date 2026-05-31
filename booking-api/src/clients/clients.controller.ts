import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClientsService } from './clients.service';
import { CreateClientSchema, UpdateClientSchema, CreateClientDto, UpdateClientDto } from './dto/client.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('clients')
@ApiBearerAuth()
@Controller('businesses/:businessId/clients')
export class ClientsController {
  constructor(private clientService: ClientsService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.findAll(
      businessId, search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 25,
    );
  }

  // Public — must be declared BEFORE @Get(':id') so NestJS doesn't swallow it as a param
  // Stricter rate limit: 5 requests per minute per IP to prevent email enumeration
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('lookup')
  async lookup(
    @Param('businessId') businessId: string,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    const client = await this.clientService.lookupByEmailOrPhone(businessId, email, phone);
    if (!client) throw new NotFoundException('No bookings found for that email or phone');
    return client;
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.findOne(id, businessId);
  }

  @Get(':id/bookings')
  @UseGuards(JwtAuthGuard)
  getHistory(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.getAppointmentHistory(id, businessId);
  }

  // Public — called during the unauthenticated booking wizard
  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateClientSchema)) dto: CreateClientDto,
  ) {
    return this.clientService.findOrCreate(businessId, dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(UpdateClientSchema)) dto: UpdateClientDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.update(id, dto, businessId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.clientService.remove(id, businessId);
  }
}
