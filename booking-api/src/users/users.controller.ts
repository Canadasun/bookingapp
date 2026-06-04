import { BadRequestException, Controller, Get, Body, Patch, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: { id: string }, @Body() data: { name?: string; phone?: string; avatarUrl?: string | null }) {
    return this.usersService.update(user.id, {
      ...(typeof data.name === 'string' ? { name: data.name.trim() } : {}),
      ...(typeof data.phone === 'string' ? { phone: data.phone.trim() } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
    });
  }

  @Get('me/device-tokens')
  listDeviceTokens(@CurrentUser() user: { id: string }) {
    return this.usersService.listDeviceTokens(user.id);
  }

  @Post('me/device-token')
  registerDeviceToken(
    @CurrentUser() user: { id: string },
    @Body() data: { token?: string; platform?: string },
  ) {
    const token = data.token?.trim();
    const platform = data.platform?.trim().toUpperCase() || 'UNKNOWN';
    if (!token || token.length < 20 || token.length > 512) {
      throw new BadRequestException('A valid device token is required');
    }
    if (!/^[A-Z0-9_-]{2,20}$/.test(platform)) {
      throw new BadRequestException('Invalid device platform');
    }
    return this.usersService.registerDeviceToken(user.id, { token, platform });
  }

  @Patch('me/device-token')
  updateDeviceToken(
    @CurrentUser() user: { id: string },
    @Body() data: { id?: string; enabled?: boolean },
  ) {
    if (!data.id || typeof data.enabled !== 'boolean') {
      throw new BadRequestException('Device token id and enabled are required');
    }
    return this.usersService.updateDeviceToken(user.id, data.id, data.enabled);
  }

  @Get('me/privacy')
  privacyStatus(@CurrentUser() user: { id: string }) {
    return this.usersService.privacyStatus(user.id);
  }

  @Patch('me/privacy')
  updatePrivacyPreferences(
    @CurrentUser() user: { id: string },
    @Body() data: { marketingConsent?: boolean; trackingConsent?: boolean; version?: string },
  ) {
    if (
      typeof data.marketingConsent !== 'boolean'
      && typeof data.trackingConsent !== 'boolean'
    ) {
      throw new BadRequestException('At least one privacy preference is required');
    }
    return this.usersService.updatePrivacyPreferences(user.id, data);
  }

  @Post('me/data-erasure')
  requestErasure(
    @CurrentUser() user: { id: string },
    @Body() data: { reason?: string },
  ) {
    return this.usersService.requestErasure(user.id, data.reason);
  }
}
