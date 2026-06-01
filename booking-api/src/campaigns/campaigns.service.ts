import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaigns.dto';

type Channel = 'EMAIL' | 'SMS';
type Audience = 'ALL' | 'RECENT' | 'LAPSED';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  create(businessId: string, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
      data: {
        businessId,
        name: dto.name,
        channel: dto.channel,
        audience: dto.audience,
        subject: dto.channel === 'EMAIL' ? dto.subject : null,
        body: dto.body,
      },
    });
  }

  list(businessId: string) {
    return this.prisma.campaign.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(businessId: string, id: string) {
    const c = await this.prisma.campaign.findFirst({ where: { id, businessId } });
    if (!c) throw new NotFoundException('Campaign not found');
    return c;
  }

  async update(businessId: string, id: string, dto: UpdateCampaignDto) {
    const c = await this.get(businessId, id);
    if (c.status !== 'DRAFT') throw new ConflictException('Only draft campaigns can be edited');
    return this.prisma.campaign.update({ where: { id }, data: dto });
  }

  async remove(businessId: string, id: string) {
    await this.get(businessId, id);
    return this.prisma.campaign.delete({ where: { id } });
  }

  // ── Audience ─────────────────────────────────────────────────────────
  private recipientWhere(businessId: string, channel: Channel, audience: Audience): Prisma.ClientWhereInput {
    const now = Date.now();
    const cutoff30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const cutoff60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const where: Prisma.ClientWhereInput = { businessId };
    // SMS needs a phone number; email is always on file.
    if (channel === 'SMS') where.phone = { not: null };

    if (audience === 'RECENT') {
      where.appointments = { some: { startsAt: { gte: cutoff30 } } };
    } else if (audience === 'LAPSED') {
      where.AND = [
        { appointments: { some: {} } },
        { appointments: { none: { startsAt: { gte: cutoff60 } } } },
      ];
    }
    return where;
  }

  audienceCount(businessId: string, channel: Channel, audience: Audience) {
    return this.prisma.client.count({ where: this.recipientWhere(businessId, channel, audience) });
  }

  async send(businessId: string, id: string) {
    const c = await this.get(businessId, id);
    if (c.status !== 'DRAFT') throw new ConflictException('Campaign has already been sent');

    const recipients = await this.prisma.client.findMany({
      where: this.recipientWhere(businessId, c.channel, c.audience),
      select: { id: true },
    });

    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENDING', recipientCount: recipients.length, sentCount: 0, sentAt: new Date() },
    });

    for (const r of recipients) {
      await this.notifications.sendCampaignMessage(id, r.id);
    }

    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENT' },
    });
  }
}
