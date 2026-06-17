import { Injectable, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateCampaignDto, UpdateCampaignDto } from './dto/campaigns.dto';
import { isPaidPlan, isProPlan } from '../common/util/plan-features';

const DAILY_CAMPAIGN_LIMIT = 3;

type Channel = 'EMAIL' | 'SMS';
type Audience = 'ALL' | 'RECENT' | 'LAPSED';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(businessId: string, dto: CreateCampaignDto) {
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { plan: true } });
    this.assertCampaignPlanAccess(business.plan, dto.channel);
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

  private assertCampaignPlanAccess(plan: import('@prisma/client').PlanTier | null | undefined, channel: Channel) {
    if (channel === 'SMS' && !isProPlan(plan)) {
      throw new ForbiddenException('SMS campaigns require a Pro or Unlimited plan');
    }
    if (channel === 'EMAIL' && !isPaidPlan(plan)) {
      throw new ForbiddenException('Email campaigns require a paid plan');
    }
  }

  list(businessId: string) {
    return this.prisma.campaign.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 500, // bound the result set
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
    return this.prisma.campaign.update({ where: { id, businessId }, data: dto });
  }

  async remove(businessId: string, id: string) {
    await this.get(businessId, id);
    return this.prisma.campaign.delete({ where: { id, businessId } });
  }

  // ── Audience ─────────────────────────────────────────────────────────
  private recipientWhere(businessId: string, channel: Channel, audience: Audience): Prisma.ClientWhereInput {
    const now = Date.now();
    const cutoff30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const cutoff60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

    const where: Prisma.ClientWhereInput = { businessId, marketingOptOut: false };
    // Only count recipients that can actually receive the selected channel.
    if (channel === 'SMS') where.phone = { not: null };
    else where.email = { not: null };

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

    // C1: re-check plan at send time to catch downgrades after creation.
    const business = await this.prisma.business.findUniqueOrThrow({ where: { id: businessId }, select: { plan: true } });
    this.assertCampaignPlanAccess(business.plan, c.channel);

    // C2: cap sends per business per calendar day.
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const todaySent = await this.prisma.campaign.count({
      where: { businessId, sentAt: { gte: todayStart }, status: { in: ['SENDING', 'SENT'] } },
    });
    if (todaySent >= DAILY_CAMPAIGN_LIMIT) {
      throw new BadRequestException(`Daily campaign limit of ${DAILY_CAMPAIGN_LIMIT} reached. Try again tomorrow.`);
    }

    const recipients = await this.prisma.client.findMany({
      where: this.recipientWhere(businessId, c.channel, c.audience),
      select: { id: true },
      take: 5000,
    });

    await this.prisma.campaign.update({
      where: { id, businessId },
      data: { status: 'SENDING', recipientCount: recipients.length, sentCount: 0, sentAt: new Date() },
    });

    await this.notifications.sendCampaignBulk(id, recipients.map((r) => r.id));

    return this.prisma.campaign.update({
      where: { id, businessId },
      data: { status: 'SENT' },
    });
  }
}
