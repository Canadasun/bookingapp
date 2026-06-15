import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePackageDto, UpdatePackageDto,
  IssueClientPackageDto, RedeemClientPackageDto,
} from './dto/packages.dto';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  // ── Package products (templates) ─────────────────────────────────────
  createPackage(businessId: string, dto: CreatePackageDto) {
    return this.prisma.package.create({ data: { businessId, ...dto } });
  }

  listPackages(businessId: string) {
    return this.prisma.package.findMany({ where: { businessId }, orderBy: { createdAt: 'desc' }, take: 500 });
  }

  private async getPackage(businessId: string, id: string) {
    const p = await this.prisma.package.findFirst({ where: { id, businessId } });
    if (!p) throw new NotFoundException('Package not found');
    return p;
  }

  async updatePackage(businessId: string, id: string, dto: UpdatePackageDto) {
    await this.getPackage(businessId, id);
    return this.prisma.package.update({ where: { id }, data: dto });
  }

  async removePackage(businessId: string, id: string) {
    await this.getPackage(businessId, id);
    return this.prisma.package.delete({ where: { id } });
  }

  // ── Client packages (issued) ─────────────────────────────────────────
  async issue(businessId: string, dto: IssueClientPackageDto) {
    const client = await this.prisma.client.findFirst({ where: { id: dto.clientId, businessId }, select: { id: true } });
    if (!client) throw new NotFoundException('Client not found');

    let name = dto.name;
    let serviceId = dto.serviceId;
    let credits = dto.credits;

    if (dto.packageId) {
      const tmpl = await this.getPackage(businessId, dto.packageId);
      name = name ?? tmpl.name;
      serviceId = serviceId ?? tmpl.serviceId ?? undefined;
      credits = credits ?? tmpl.credits;
    }
    if (!name || !credits) throw new BadRequestException('Package name and credits are required');
    if (serviceId) {
      const service = await this.prisma.service.findFirst({
        where: { id: serviceId, businessId },
        select: { id: true },
      });
      if (!service) throw new NotFoundException('Service not found');
    }

    return this.prisma.clientPackage.create({
      data: {
        businessId,
        packageId: dto.packageId,
        clientId: dto.clientId,
        name,
        serviceId,
        creditsTotal: credits,
        creditsRemaining: credits,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
  }

  listClientPackages(businessId: string, clientId?: string) {
    return this.prisma.clientPackage.findMany({
      where: { businessId, ...(clientId ? { clientId } : {}) },
      include: { client: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
      take: 1000, // bound the result set
    });
  }

  private async getClientPackage(businessId: string, id: string) {
    const cp = await this.prisma.clientPackage.findFirst({
      where: { id, businessId },
      include: { redemptions: { orderBy: { createdAt: 'desc' } }, client: { select: { id: true, name: true, email: true } } },
    });
    if (!cp) throw new NotFoundException('Client package not found');
    return cp;
  }

  getClientPackageDetail(businessId: string, id: string) {
    return this.getClientPackage(businessId, id);
  }

  async redeem(businessId: string, id: string, dto: RedeemClientPackageDto) {
    // SERIALIZABLE isolation ensures two concurrent redemptions cannot both read
    // the same balance and both deduct from it — mirrors gift-cards.service.ts.
    const updated = await this.prisma.$transaction(async (tx) => {
      const cp = await tx.clientPackage.findFirst({
        where: { id, businessId },
      });
      if (!cp) throw new NotFoundException('Client package not found');
      if (cp.status === 'VOID') throw new BadRequestException('This package has been voided');
      if (cp.expiresAt && cp.expiresAt < new Date()) throw new BadRequestException('This package has expired');
      if (cp.creditsRemaining <= 0) throw new BadRequestException('No credits remaining on this package');
      if (dto.appointmentId) {
        const appointment = await tx.appointment.findFirst({
          where: { id: dto.appointmentId, businessId, clientId: cp.clientId },
          select: { id: true },
        });
        if (!appointment) throw new NotFoundException('Appointment not found');
      }

      const remaining = cp.creditsRemaining - 1;
      await tx.packageRedemption.create({
        data: { clientPackageId: cp.id, appointmentId: dto.appointmentId },
      });
      return tx.clientPackage.update({
        where: { id: cp.id },
        data: { creditsRemaining: remaining, status: remaining === 0 ? 'USED' : 'ACTIVE' },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { creditsRemaining: updated.creditsRemaining, status: updated.status };
  }

  async void(businessId: string, id: string) {
    await this.getClientPackage(businessId, id);
    return this.prisma.clientPackage.update({ where: { id }, data: { status: 'VOID' } });
  }
}
