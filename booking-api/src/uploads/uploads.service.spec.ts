import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { UploadsService } from './uploads.service';
import { PrismaService } from '../prisma/prisma.service';

function file(over: Partial<{ buffer: Buffer; mimetype: string; size: number }> = {}) {
  const buffer = over.buffer ?? Buffer.from('x');
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

  it('rejects a non-image MIME type', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', file({ mimetype: 'application/pdf' }), 'LOGO')).rejects.toThrow(BadRequestException);
  });

  it('rejects an image larger than 2 MB', async () => {
    const { svc } = await build();
    await expect(svc.create('biz1', file({ size: 3 * 1024 * 1024 }), 'LOGO')).rejects.toThrow(PayloadTooLargeException);
  });
});
