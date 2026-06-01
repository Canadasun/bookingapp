import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignSchema, CreateCampaignDto, UpdateCampaignSchema, UpdateCampaignDto } from './dto/campaigns.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

type AuthUser = { id: string; role: string; businessId: string | null };
function assertOwns(user: AuthUser, businessId: string) {
  if (user.role !== 'ADMIN' && user.businessId !== businessId) {
    throw new ForbiddenException('You do not have access to this business');
  }
}

type Channel = 'EMAIL' | 'SMS';
type Audience = 'ALL' | 'RECENT' | 'LAPSED';

@ApiTags('campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('businesses/:businessId/campaigns')
export class CampaignsController {
  constructor(private svc: CampaignsService) {}

  @Get()
  list(@Param('businessId') businessId: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.list(businessId);
  }

  // Live recipient count for the compose screen.
  @Get('audience')
  audience(
    @Param('businessId') businessId: string,
    @Query('channel') channel: Channel = 'EMAIL',
    @Query('audience') audience: Audience = 'ALL',
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.audienceCount(businessId, channel, audience).then((count) => ({ count }));
  }

  @Post()
  create(
    @Param('businessId') businessId: string,
    @Body(new ZodValidationPipe(CreateCampaignSchema)) dto: CreateCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.create(businessId, dto);
  }

  @Patch(':id')
  update(
    @Param('businessId') businessId: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateCampaignSchema)) dto: UpdateCampaignDto,
    @CurrentUser() user: AuthUser,
  ) {
    assertOwns(user, businessId);
    return this.svc.update(businessId, id, dto);
  }

  @Post(':id/send')
  send(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.send(businessId, id);
  }

  @Delete(':id')
  remove(@Param('businessId') businessId: string, @Param('id') id: string, @CurrentUser() user: AuthUser) {
    assertOwns(user, businessId);
    return this.svc.remove(businessId, id);
  }
}
