import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateMigrationLeadDto } from './dto/migration-lead.dto';

@Injectable()
export class MigrationLeadsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // Persist the lead first (so it can never be silently lost), then fire the
  // best-effort admin email. Returns a minimal ack — no data leaks to the public.
  async create(dto: CreateMigrationLeadDto) {
    const lead = await this.prisma.migrationLead.create({
      data: {
        name: dto.name,
        email: dto.email,
        businessName: dto.business,
        sourcePlatform: dto.platform,
        notes: dto.message?.trim() || null,
      },
    });
    await this.notifications.sendMigrationLeadAlert(lead.id).catch(() => {});
    return { ok: true };
  }

  listForAdmin() {
    return this.prisma.migrationLead.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async updateStatus(id: string, status: string) {
    const lead = await this.prisma.migrationLead.findUnique({ where: { id } });
    if (!lead) throw new NotFoundException('Lead not found');
    return this.prisma.migrationLead.update({ where: { id }, data: { status } });
  }
}
