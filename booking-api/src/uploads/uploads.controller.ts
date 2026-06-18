import {
  Controller, Post, Get, Param, Body, Res, UseGuards, UseInterceptors, UploadedFile, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadsService, type IncomingFile } from './uploads.service';
import { UploadKind, User } from '@prisma/client';

@ApiTags('uploads')
@Controller('uploads')
export class UploadsController {
  constructor(private uploads: UploadsService) {}

  // Owner — upload an image (logo / avatar / cover). Scoped to the owner's business.
  // Hard 5 MB cap at the parser (memory safety); the real 2 MB + MIME rules live
  // in the service so the client gets a clean error.
  @Post()
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: IncomingFile,
    @Body('kind') kind: string | undefined,
    @CurrentUser() user: { businessId: string | null },
  ) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    const VALID_KINDS = ['LOGO', 'AVATAR', 'COVER', 'OTHER'];
    if (!VALID_KINDS.includes(kind ?? '')) throw new ForbiddenException(`Invalid upload kind; must be one of: ${VALID_KINDS.join(', ')}`);
    const k = (kind ?? 'OTHER') as UploadKind;
    return this.uploads.create(user.businessId, file, k);
  }

  // Public — images are served by id (logos appear on the public booking page).
  // Documents (kind=OTHER) require authentication.
  // Resolves to a redirect (public bucket/CDN) or raw bytes (DB or private bucket).
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async serve(@Param('id') id: string, @Res() res: Response, @CurrentUser() user: User | null) {
    const r = await this.uploads.resolve(id, user);
    if (r.redirectUrl) return res.redirect(302, r.redirectUrl);
    res.setHeader('Content-Type', r.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', r.isPrivate ? 'attachment' : 'inline');
    // Documents (verification uploads) must never be cached by proxies or browsers.
    res.setHeader('Cache-Control', r.isPrivate ? 'private, no-store' : 'public, max-age=31536000, immutable');
    res.send(r.buffer);
  }
}
