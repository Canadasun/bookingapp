import { Injectable, BadRequestException, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadKind } from '@prisma/client';
import { sniffDocumentMime, sniffImageMime } from './sniff';
import { objectStorageEnabled, putObject, getObjectBytes, newStorageKey, publicUrlFor } from './object-storage';

// Allow common raster web image types only. SVG is intentionally excluded
// because it can embed script-like content.
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const ALLOWED_DOCUMENT_MIME = new Set(['application/pdf']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024; // 5 MB

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
    const allowsDocument = kind === 'OTHER';
    const allowedMime = allowsDocument
      ? new Set([...ALLOWED_MIME, ...ALLOWED_DOCUMENT_MIME])
      : ALLOWED_MIME;
    if (!allowedMime.has(file.mimetype)) {
      throw new BadRequestException(allowsDocument
        ? 'Only PNG, JPEG, WebP, GIF, or PDF files are allowed'
        : 'Only PNG, JPEG, WebP, or GIF images are allowed');
    }
    const maxBytes = allowsDocument ? MAX_DOCUMENT_BYTES : MAX_BYTES;
    if (file.size > maxBytes) {
      throw new PayloadTooLargeException(allowsDocument ? 'File must be 5 MB or smaller' : 'Image must be 2 MB or smaller');
    }

    // Content sniffing: the real bytes must be one of the allowed file types,
    // regardless of the client-declared Content-Type. The sniffed type is stored
    // as the authoritative MIME.
    const sniffed = sniffImageMime(file.buffer) ?? (allowsDocument ? sniffDocumentMime(file.buffer) : null);
    if (!sniffed || !allowedMime.has(sniffed)) {
      throw new BadRequestException(allowsDocument
        ? 'File content is not a valid PNG, JPEG, WebP, GIF, or PDF file'
        : 'File content is not a valid PNG, JPEG, WebP, or GIF image');
    }

    // Object storage when configured; otherwise the bytes live in the DB. Either
    // way the public URL shape (/uploads/:id) is identical.
    if (objectStorageEnabled()) {
      const storageKey = newStorageKey(businessId);
      await putObject(storageKey, file.buffer, sniffed);
      const row = await this.prisma.uploadedFile.create({
        data: { businessId, kind, mimeType: sniffed, sizeBytes: file.size, storageKey },
        select: { id: true },
      });
      return { id: row.id, url: `/uploads/${row.id}`, kind };
    }

    const row = await this.prisma.uploadedFile.create({
      data: { businessId, kind, mimeType: sniffed, sizeBytes: file.size, data: file.buffer },
      select: { id: true },
    });
    return { id: row.id, url: `/uploads/${row.id}`, kind };
  }

  async get(id: string) {
    const file = await this.prisma.uploadedFile.findUnique({ where: { id } });
    if (!file) throw new NotFoundException('File not found');
    return file;
  }

  // Resolve an upload for serving: either a redirect URL (public bucket / CDN) or
  // the raw bytes (DB storage, or streamed from a private bucket).
  async resolve(id: string): Promise<{ redirectUrl?: string; buffer?: Buffer; contentType: string }> {
    const file = await this.get(id);
    if (file.storageKey) {
      const pub = publicUrlFor(file.storageKey);
      if (pub) return { redirectUrl: pub, contentType: file.mimeType };
      const obj = await getObjectBytes(file.storageKey);
      if (!obj) throw new NotFoundException('File not found');
      return { buffer: obj.buffer, contentType: obj.contentType || file.mimeType };
    }
    if (!file.data) throw new NotFoundException('File not found');
    return { buffer: Buffer.from(file.data), contentType: file.mimeType };
  }
}
