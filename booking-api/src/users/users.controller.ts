import { BadRequestException, Controller, Get, Body, Patch, Post, UseGuards } from '@nestjs/common';

const INTERNAL_UPLOAD = /^\/(?:proxy\/)?uploads\/[a-zA-Z0-9-]+$/;
function isValidAvatarUrl(url: string): boolean {
  if (INTERNAL_UPLOAD.test(url)) return true;
  try { return new URL(url).protocol === 'https:'; } catch { return false; }
}
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { normalizePhone } from '../common/util/phone';

const phoneSchema = z
  .preprocess((v) => v === '' ? null : v, z.string().trim().nullable().optional())
  .transform((v, ctx) => {
    if (v == null) return null;
    const normalized = normalizePhone(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a valid phone number, e.g. +1 555 123 4567' });
      return z.NEVER;
    }
    return normalized;
  });

const UpdateMeSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  phone: phoneSchema,
  avatarUrl: z.string().nullable().optional().refine(
    (v) => v == null || isValidAvatarUrl(v),
    { message: 'avatarUrl must be an https:// URL or an internal /uploads/ path' },
  ),
  locale: z.enum(['en', 'fr']).optional(),
});

const UpdatePrivacySchema = z.object({
  marketingConsent: z.boolean().optional(),
  trackingConsent: z.boolean().optional(),
  version: z.string().max(50).optional(),
}).refine(
  (d) => d.marketingConsent !== undefined || d.trackingConsent !== undefined,
  { message: 'At least one privacy preference is required' },
);

const ErasureSchema = z.object({
  reason: z.string().max(1000).optional(),
});

const TourProgressSchema = z.object({
  tourKey: z.string().regex(/^[a-z0-9-]{1,80}$/),
  version: z.number().int().min(1).max(1000),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'DISMISSED']),
  currentStep: z.number().int().min(0).max(100).default(0),
});

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: { id: string }) {
    return this.usersService.findOne(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(UpdateMeSchema)) data: z.infer<typeof UpdateMeSchema>,
  ) {
    return this.usersService.update(user.id, {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.locale !== undefined ? { locale: data.locale } : {}),
    });
  }

  @Get('me/device-tokens')
  listDeviceTokens(@CurrentUser() user: { id: string }) {
    return this.usersService.listDeviceTokens(user.id);
  }

  @Get('me/feature-tours')
  featureTours(@CurrentUser() user: { id: string }) {
    return this.usersService.featureTours(user.id);
  }

  @Patch('me/feature-tours')
  updateFeatureTour(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(TourProgressSchema)) data: z.infer<typeof TourProgressSchema>,
  ) {
    return this.usersService.updateFeatureTour(user.id, data);
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
    @Body(new ZodValidationPipe(UpdatePrivacySchema)) data: z.infer<typeof UpdatePrivacySchema>,
  ) {
    return this.usersService.updatePrivacyPreferences(user.id, data);
  }

  @Post('me/data-erasure')
  requestErasure(
    @CurrentUser() user: { id: string },
    @Body(new ZodValidationPipe(ErasureSchema)) data: z.infer<typeof ErasureSchema>,
  ) {
    return this.usersService.requestErasure(user.id, data.reason);
  }
}
