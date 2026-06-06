import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { PrismaService } from '../prisma/prisma.service';

// A minimal valid PNG header so content-sniffing passes for the happy paths.
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF_MAGIC = Buffer.from('%PDF-1.7\n');

function file(over: Partial<{ buffer: Buffer; mimetype: string; size: number }> = {}) {
  const buffer = over.buffer ?? PNG_MAGIC;
  return { buffer, mimetype: over.mimetype ?? 'image/png', size: over.size ?? buffer.length };
}

async function build() {
  const prisma = { uploadedFile: { create: jest.fn().mockResolvedValue({ id: 'f1' }) } };
  const module: TestingModule = await Test.createTestingModule({
    providers: [UploadsService, { provide: PrismaService, useValue: prisma }],
  }).compile();
  return { svc: module.get(UploadsService), prisma };
}

describe('UploadsService.create', () => {
  it('stores a valid image and returns its public url', async () => {
    const { svc, prisma } = await build();
    const res = await svc.create('biz1', file(), 'LOGO');
    expect(res).toEqual({ id: 'f1', url: '/uploads/f1', kind: 'LOGO' });
    expect(prisma.uploadedFile.create).toHaveBeenCalled();
  });

  it('rejects a missing file', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', undefined, 'LOGO')).rejects.toThrow(BadRequestException);
  });

  it('rejects bytes that are not a real image even with an allowed MIME (content sniffing)', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', file({ buffer: Buffer.from('definitely not an image') }), 'LOGO'))
      .rejects.toThrow(BadRequestException);
  });

  it('accepts a PDF for generic document uploads', async () => {
    const { svc, prisma } = await build();
    const res = await svc.create('biz1', file({ buffer: PDF_MAGIC, mimetype: 'application/pdf' }), 'OTHER');
    expect(res).toEqual({ id: 'f1', url: '/uploads/f1', kind: 'OTHER' });
    expect(prisma.uploadedFile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ mimeType: 'application/pdf' }),
    }));
  });

  it('rejects a PDF for image-only upload kinds', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', file({ mimetype: 'application/pdf' }), 'LOGO')).rejects.toThrow(BadRequestException);
  });

  it('rejects SVG images even though they are image MIME types', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', file({ mimetype: 'image/svg+xml' }), 'LOGO')).rejects.toThrow(BadRequestException);
  });

  it('accepts an image exactly at the 2 MB limit', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', file({ size: 2 * 1024 * 1024 }), 'LOGO')).resolves.toMatchObject({
      id: 'f1',
      url: '/uploads/f1',
    });
  });

  it('rejects an image larger than 2 MB', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', file({ size: 3 * 1024 * 1024 }), 'LOGO')).rejects.toThrow(PayloadTooLargeException);
  });
});
