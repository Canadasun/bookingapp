import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResourcesService {
  constructor(private prisma: PrismaService) {}

  findAll(businessId: string, includeInactive = false) {
    return this.prisma.resource.findMany({
      where: { businessId, ...(includeInactive ? {} : { active: true }) },
      orderBy: { name: 'asc' },
    });
  }

  create(businessId: string, data: { name: string }) {
    return this.prisma.resource.create({ data: { businessId, name: data.name.trim() } });
  }

  async update(id: string, businessId: string, data: { name?: string; active?: boolean }) {
    const resource = await this.prisma.resource.findFirst({ where: { id, businessId } });
    if (!resource) throw new NotFoundException('Resource not found');
    return this.prisma.resource.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    });
  }

  async remove(id: string, businessId: string) {
    const resource = await this.prisma.resource.findFirst({ where: { id, businessId } });
    if (!resource) throw new NotFoundException('Resource not found');
    // Services referencing it are detached via the schema's ON DELETE SET NULL.
    await this.prisma.resource.delete({ where: { id } });
    return { ok: true };
  }
}
