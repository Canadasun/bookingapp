import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateServiceDto, UpdateServiceDto,
  CreateCategoryDto, UpdateCategoryDto,
} from './dto/service.dto';

@Injectable()
export class ServicesService {
  constructor(private prisma: PrismaService) {}

  private async assertCategoryOwnership(businessId: string, categoryId?: string | null) {
    if (!categoryId) return;
    const category = await this.prisma.serviceCategory.findFirst({
      where: { id: categoryId, businessId },
      select: { id: true },
    });
    if (!category) throw new NotFoundException('Category not found');
  }

  // ── Services ────────────────────────────────────────────────────────────────

  findAll(businessId: string, includeInactive = false) {
    return this.prisma.service.findMany({
      where: { businessId, ...(includeInactive ? {} : { active: true }) },
      include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, businessId: string) {
    const service = await this.prisma.service.findFirst({
      where: { id, businessId },
      include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
    });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  async create(businessId: string, dto: CreateServiceDto) {
    const { categoryId, ...rest } = dto;
    await this.assertCategoryOwnership(businessId, categoryId);
    return this.prisma.service.create({
      data: {
        ...rest,
        businessId,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
    });
  }

  async update(id: string, dto: UpdateServiceDto, businessId: string) {
    const service = await this.findOne(id, businessId);
    const { categoryId, ...rest } = dto;
    await this.assertCategoryOwnership(businessId, categoryId);
    return this.prisma.service.update({
      where: { id: service.id, businessId: service.businessId },
      data: {
        ...rest,
        ...(categoryId !== undefined ? { categoryId: categoryId ?? null } : {}),
      },
      include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
    });
  }

  async remove(id: string, businessId: string) {
    const service = await this.findOne(id, businessId);
    const appointments = await this.prisma.appointment.count({ where: { serviceId: service.id } });
    if (appointments > 0) {
      throw new BadRequestException('This service has appointment history and cannot be permanently deleted.');
    }
    return this.prisma.service.delete({ where: { id: service.id, businessId: service.businessId } });
  }

  // ── Categories ───────────────────────────────────────────────────────────────

  findAllCategories(businessId: string, includeInactive = false) {
    return this.prisma.serviceCategory.findMany({
      where: { businessId, ...(includeInactive ? {} : { active: true }) },
      include: {
        services: {
          where: includeInactive ? {} : { active: true },
          include: { category: { select: { id: true, name: true, color: true, sortOrder: true } } },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  createCategory(businessId: string, dto: CreateCategoryDto) {
    return this.prisma.serviceCategory.create({
      data: { ...dto, businessId },
      include: { services: true },
    });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, businessId: string) {
    const cat = await this.prisma.serviceCategory.findFirst({
      where: { id, businessId }
    });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.serviceCategory.update({
      where: { id, businessId: cat.businessId },
      data: dto,
      include: { services: { include: { category: true } } },
    });
  }

  async removeCategory(id: string, businessId: string) {
    const cat = await this.prisma.serviceCategory.findFirst({
      where: { id, businessId }
    });
    if (!cat) throw new NotFoundException('Category not found');
    await this.prisma.service.updateMany({ where: { categoryId: id, businessId }, data: { categoryId: null } });
    return this.prisma.serviceCategory.delete({ where: { id, businessId: cat.businessId } });
  }
}
