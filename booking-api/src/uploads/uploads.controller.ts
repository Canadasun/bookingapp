import {
  Controller, Post, Get, Param, Body, Res, UseGuards, UseInterceptors, UploadedFile, ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadsService, type IncomingFile } from './uploads.service';
import { UploadKind } from '@prisma/client';

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
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: IncomingFile,
    @Body('kind') kind: string | undefined,
    @CurrentUser() user: { businessId: string | null },
  ) {
    if (!user.businessId) throw new ForbiddenException('No business on this account');
    const k = (['LOGO', 'AVATAR', 'COVER'].includes(kind ?? '') ? kind : 'OTHER') as UploadKind;
    return this.uploads.create(user.businessId, file, k);
  }

  // Public — images are served by id (logos appear on the public booking page).
  @Get(':id')
  async serve(@Param('id') id: string, @Res() res: Response) {
    const file = await this.uploads.get(id);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(file.data);
  }
}
