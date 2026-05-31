import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ServicesService } from './services.service';
import {
  CreateServiceSchema, UpdateServiceSchema, CreateServiceDto, UpdateServiceDto,
  CreateCategorySchema, UpdateCategorySchema, CreateCategoryDto, UpdateCategoryDto,
} from './dto/service.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// ── Services ─────────────────────────────────────────────────────────────────

@ApiTags('services')
@Controller('businesses/:businessId/services')
export class ServicesController {
  constructor(private serviceService: ServicesService) {}

  @Get()
  findAll(@Param('businessId') businessId: string) {
    return this.serviceService.findAll(businessId);
  }

  @Get('all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findAllAdmin(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.findAll(businessId, true);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
  ) {
    return this.serviceService.findOne(id, businessId);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateServiceSchema)) dto: CreateServiceDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.create(businessId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(UpdateServiceSchema)) dto: UpdateServiceDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.update(id, dto, businessId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.remove(id, businessId);
  }
}

// ── Service Categories ────────────────────────────────────────────────────────

@ApiTags('service-categories')
@Controller('businesses/:businessId/service-categories')
export class ServiceCategoriesController {
  constructor(private serviceService: ServicesService) {}

  @Get()
  findAll(@Param('businessId') businessId: string) {
    return this.serviceService.findAllCategories(businessId);
  }

  @Get('all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  findAllAdmin(
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.findAllCategories(businessId, true);
  }

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateCategorySchema)) dto: CreateCategoryDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.createCategory(businessId, dto);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(UpdateCategorySchema)) dto: UpdateCategoryDto,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.updateCategory(id, dto, businessId);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  remove(
    @Param('id') id: string,
    @Param('businessId') businessId: string,
    @CurrentUser() user: { role: string; businessId: string | null },
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== businessId) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.serviceService.removeCategory(id, businessId);
  }
}
