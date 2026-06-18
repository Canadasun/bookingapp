import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export type ErrorCategory = 'PAYMENT' | 'BOOKING' | 'SMS' | 'EMAIL' | 'CALENDAR' | 'AUTH' | 'GENERAL';
export type ErrorSeverity = 'WARN' | 'ERROR' | 'CRITICAL';

@Injectable()
export class SystemErrorsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

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

  async resolveAll(businessId?: string) {
    return this.prisma.systemError.updateMany({
      where: { ...(businessId ? { businessId } : {}), resolved: false },
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

  /** Group unresolved errors by category to surface patterns for admin triage. */
  async patterns() {
    const rows = await this.prisma.systemError.groupBy({
      by: ['category', 'severity'],
      where: { resolved: false },
      _count: { _all: true },
      orderBy: { _count: { category: 'desc' } },
    });
    // Roll up by category
    const map = new Map<string, { category: string; total: number; critical: number; error: number; warn: number }>();
    for (const r of rows) {
      const entry = map.get(r.category) ?? { category: r.category, total: 0, critical: 0, error: 0, warn: 0 };
      entry.total += r._count._all;
      if (r.severity === 'CRITICAL') entry.critical += r._count._all;
      else if (r.severity === 'ERROR') entry.error += r._count._all;
      else entry.warn += r._count._all;
      map.set(r.category, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  /** Per-business unresolved error counts — highlights which tenants need attention. */
  async businessHealth(limit = 20) {
    const rows = await this.prisma.systemError.groupBy({
      by: ['businessId'],
      where: { resolved: false, businessId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { businessId: 'desc' } },
      take: limit,
    });
    const ids = rows.map((r) => r.businessId!);
    const businesses = await this.prisma.business.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true, plan: true },
    });
    const bizMap = new Map(businesses.map((b) => [b.id, b]));
    return rows.map((r) => ({ ...bizMap.get(r.businessId!), errorCount: r._count._all }));
  }

  /**
   * Use OpenAI to summarise recent unresolved errors and suggest fixes.
   * No-ops (returns null) when OPENAI_API_KEY is not configured.
   */
  async aiExplain(category?: string) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return { explanation: null, reason: 'OPENAI_API_KEY not configured' };

    const errors = await this.prisma.systemError.findMany({
      where: { resolved: false, ...(category ? { category } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { category: true, severity: true, message: true, createdAt: true },
    });
    if (errors.length === 0) return { explanation: 'No unresolved errors to explain.' };

    const summary = errors
      .map((e) => `[${e.severity}][${e.category}] ${e.message}`)
      .join('\n')
      .slice(0, 3000);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 400,
        messages: [
          {
            role: 'system',
            content: 'You are a senior engineer reviewing production errors for a booking SaaS. Be concise — 3-5 bullet points max.',
          },
          {
            role: 'user',
            content: `Here are recent unresolved errors:\n\n${summary}\n\nBriefly: what patterns do you see and what should be investigated first?`,
          },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return { explanation: null, reason: `OpenAI error: ${err.slice(0, 200)}` };
    }
    const data = await res.json() as { choices: { message: { content: string } }[] };
    return { explanation: data.choices[0]?.message?.content ?? null };
  }
}
