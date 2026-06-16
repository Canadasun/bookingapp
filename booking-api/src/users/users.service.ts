import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, role: true, businessId: true, avatarUrl: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: { name?: string; phone?: string | null; avatarUrl?: string | null }) {
    return this.prisma.user.update({
      where: { id },
      // Only write fields that were actually provided (avatarUrl may be null to clear).
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      },
      select: { id: true, email: true, name: true, phone: true, role: true, businessId: true, avatarUrl: true },
    });
  }

  registerDeviceToken(id: string, data: { token: string; platform: string }) {
    return this.prisma.deviceToken.upsert({
      where: { token: data.token },
      update: { userId: id, platform: data.platform, enabled: true },
      create: { userId: id, token: data.token, platform: data.platform },
      select: { id: true, platform: true, enabled: true, createdAt: true, updatedAt: true },
    });
  }

  listDeviceTokens(id: string) {
    return this.prisma.deviceToken.findMany({
      where: { userId: id },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, platform: true, enabled: true, createdAt: true, updatedAt: true },
    });
  }

  updateDeviceToken(id: string, tokenId: string, enabled: boolean) {
    return this.prisma.deviceToken.updateMany({
      where: { id: tokenId, userId: id },
      data: { enabled },
    }).then(() => ({ ok: true }));
  }

  async privacyStatus(id: string) {
    const [consents, erasureRequests] = await Promise.all([
      this.prisma.privacyConsent.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, granted: true, version: true, source: true, createdAt: true },
      }),
      this.prisma.dataErasureRequest.findMany({
        where: { userId: id },
        orderBy: { requestedAt: 'desc' },
        select: { id: true, status: true, reason: true, requestedAt: true, completedAt: true },
      }),
    ]);
    return { consents, erasureRequests };
  }

  async updatePrivacyPreferences(id: string, input: { marketingConsent?: boolean; trackingConsent?: boolean; version?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { businessId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const version = input.version?.trim() || '2026-06-03';
    const rows = [
      typeof input.marketingConsent === 'boolean'
        ? { type: 'MARKETING' as const, granted: input.marketingConsent }
        : null,
      typeof input.trackingConsent === 'boolean'
        ? { type: 'TRACKING' as const, granted: input.trackingConsent }
        : null,
    ].filter((r): r is { type: 'MARKETING' | 'TRACKING'; granted: boolean } => !!r);
    if (!rows.length) return this.privacyStatus(id);
    await this.prisma.privacyConsent.createMany({
      data: rows.map((r) => ({
        userId: id,
        businessId: user.businessId,
        type: r.type,
        granted: r.granted,
        version,
        source: 'preference_center',
      })),
    });
    return this.privacyStatus(id);
  }

  async requestErasure(id: string, reason?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { businessId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const existing = await this.prisma.dataErasureRequest.findFirst({
      where: { userId: id, status: { in: ['REQUESTED', 'VERIFYING', 'PROCESSING'] } },
      orderBy: { requestedAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.dataErasureRequest.create({
      data: { userId: id, businessId: user.businessId, reason: reason?.trim() || undefined },
    });
  }
}
