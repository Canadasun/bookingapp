import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BusinessesService } from './businesses.service';
import { CreateBusinessSchema, UpdateBusinessSchema, CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User, Role } from '@prisma/client';

@ApiTags('business')
@ApiBearerAuth()
@Controller('businesses')
export class BusinessesController {
  constructor(private businessService: BusinessesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
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

  // Pause the business (reversible) — hides the public booking page, keeps data.
  @Post(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user: User) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.deactivate(id);
  }

  @Post(':id/reactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  reactivate(@Param('id') id: string, @CurrentUser() user: User) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.reactivate(id);
  }

  // Permanently delete the business and ALL its data. Irreversible. Requires the
  // owner to type the business name back as `confirmation`.
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.OWNER, Role.ADMIN)
  remove(
    @Param('id') id: string,
    @Body() body: { confirmation?: string },
    @CurrentUser() user: User,
  ) {
    if (user.role !== 'ADMIN' && user.businessId !== id) {
      throw new ForbiddenException('You do not have access to this business');
    }
    return this.businessService.deleteAccount(id, body?.confirmation ?? '');
  }
}
