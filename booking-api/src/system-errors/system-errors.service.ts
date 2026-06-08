import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type ErrorCategory = 'PAYMENT' | 'BOOKING' | 'SMS' | 'EMAIL' | 'CALENDAR' | 'AUTH' | 'GENERAL';
export type ErrorSeverity = 'WARN' | 'ERROR' | 'CRITICAL';

@Injectable()
export class SystemErrorsService {
  constructor(private prisma: PrismaService) {}

  async log(opts: {
    businessId?: string;
    category: ErrorCategory;
    severity?: ErrorSeverity;
    message: string;
    stack?: string;
    context?: Record<string, unknown>;
  }) {
    try {
      await this.prisma.systemError.create({
        data: {
          businessId: opts.businessId ?? null,
          category: opts.category,
          severity: opts.severity ?? 'ERROR',
          message: opts.message.slice(0, 2000),
          stack: opts.stack?.slice(0, 5000) ?? null,
          context: (opts.context ?? {}) as any,
        },
      });
    } catch {
      // Never let error logging crash the caller
    }
  }

  async list(businessId?: string, opts?: { resolved?: boolean; category?: string; limit?: number }) {
    return this.prisma.systemError.findMany({
      where: {
        ...(businessId ? { businessId } : {}),
        ...(opts?.resolved !== undefined ? { resolved: opts.resolved } : {}),
        ...(opts?.category ? { category: opts.category } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts?.limit ?? 100,
    });
  }

  async resolve(id: string, businessId?: string) {
    return this.prisma.systemError.updateMany({
      where: { id, ...(businessId ? { businessId } : {}) },
      data: { resolved: true, resolvedAt: new Date() },
    });
  }

  async resolveAll(businessId: string) {
    return this.prisma.systemError.updateMany({
      where: { businessId, resolved: false },
      data: { resolved: true, resolvedAt: new Date() },
    });
  }

  async counts(businessId: string) {
    const [critical, error, warn] = await Promise.all([
      this.prisma.systemError.count({ where: { businessId, resolved: false, severity: 'CRITICAL' } }),
      this.prisma.systemError.count({ where: { businessId, resolved: false, severity: 'ERROR' } }),
      this.prisma.systemError.count({ where: { businessId, resolved: false, severity: 'WARN' } }),
    ]);
    return { critical, error, warn, total: critical + error + warn };
  }
}
