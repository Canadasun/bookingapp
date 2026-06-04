import { Controller, Get, Post, Patch, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessSchema, UpdateBusinessSchema, CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '@prisma/client';

@ApiTags('business')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private businessService: BusinessesService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(
    @Body(new ZodValidationPipe(CreateBusinessSchema)) dto: CreateBusinessDto,
    @CurrentUser() user: User,
  ) {
    return this.businessService.create(dto, user.id);
  }

  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.businessService.findBySlugPublic(slug);
  }

  @Get('public/:id')
  findPublicById(@Param('id') id: string) {
    return this.businessService.findPublicById(id);
  }

  // Full business record (incl. email, plan) — owner dashboard only. The public
  // booking page uses GET /businesses/slug/:slug or /businesses/public/:id.
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateBusinessSchema)) dto: UpdateBusinessDto,
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.update(id, dto);
  }
}
