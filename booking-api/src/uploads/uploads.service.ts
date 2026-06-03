import { Injectable, BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadKind } from '@prisma/client';

// Allow common web image types only. (Validated server-side regardless of the
// client-declared type the browser sends.)
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export interface IncomingFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

@Injectable()
export class UploadsService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, file: IncomingFile | undefined, kind: UploadKind) {
    if (!file || !file.buffer?.length) throw new BadRequestException('No file uploaded');
    if (!ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Only PNG, JPEG, WebP, or GIF images are allowed');
    }
    if (file.size > MAX_BYTES) throw new PayloadTooLargeException('Image must be 2 MB or smaller');

    const row = await this.prisma.uploadedFile.create({
      data: { businessId, kind, mimeType: file.mimetype, sizeBytes: file.size, data: file.buffer },
      select: { id: true },
    });
    // The stored URL shape stays stable even if storage moves to S3/R2 later.
    return { id: row.id, url: `/uploads/${row.id}`, kind };
  }

  async get(id: string) {
    const file = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }
}
