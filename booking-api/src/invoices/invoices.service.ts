import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateInvoiceDto) {
    const biz = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { taxRatePercent: true, currency: true },
    });
    const lineItems = dto.lineItems.map((li) => ({
      description: li.description.trim(),
      quantity: li.quantity,
      unitCents: li.unitCents,
      amountCents: li.quantity * li.unitCents,
    }));
    const subtotalCents = lineItems.reduce((s, li) => s + li.amountCents, 0);
    const taxRatePercent = biz.taxRatePercent ?? 0;
    const taxCents = Math.round(subtotalCents * (taxRatePercent / 100));
    const totalCents = subtotalCents + taxCents;

    // Atomically claim the next per-business invoice number.
    return this.prisma.$transaction(async (tx) => {
      const b = await tx.business.update({
        where: { id: businessId },
        data: { invoiceSeq: { increment: 1 } },
        select: { invoiceSeq: true },
      });
      return tx.invoice.create({
        data: {
          businessId,
          clientId: dto.clientId || null,
          number: b.invoiceSeq,
          lineItems,
          notes: dto.notes,
          currency: biz.currency,
          subtotalCents,
          taxRatePercent,
          taxCents,
          totalCents,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        },
        include: { client: { select: { id: true, name: true, email: true, phone: true } } },
      });
    });
  }

  list(businessId: string) {
    return this.prisma.invoice.findMany({
      where: { businessId },
      orderBy: { number: 'desc' },
      include: { client: { select: { id: true, name: true, email: true } } },
      take: 200,
    });
  }

  async get(id: string, businessId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, businessId },
      include: { client: { select: { id: true, name: true, email: true, phone: true } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async updateStatus(id: string, businessId: string, dto: UpdateInvoiceStatusDto) {
    await this.get(id, businessId);
    return this.prisma.invoice.update({ where: { id }, data: { status: dto.status } });
  }

  async remove(id: string, businessId: string) {
    await this.get(id, businessId);
    await this.prisma.invoice.delete({ where: { id } });
    return { ok: true };
  }
}
