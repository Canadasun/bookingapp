import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResendEmailProvider } from '../notifications/providers/email.provider';
import { CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  private email = new ResendEmailProvider();

  constructor(private prisma: PrismaService) {}

  private calcTotals(
    lineItems: { quantity: number; unitCents: number }[],
    taxRatePercent: number,
    discountCents: number,
  ) {
    const lines = lineItems.map((li) => ({
      ...li,
      description: typeof (li as any).description === 'string' ? (li as any).description.trim() : '',
      amountCents: li.quantity * li.unitCents,
    }));
    const subtotalCents = lines.reduce((s, li) => s + li.amountCents, 0);
    const discounted = Math.max(subtotalCents - discountCents, 0);
    const taxCents = Math.round(discounted * (taxRatePercent / 100));
    const totalCents = discounted + taxCents;
    return { lines, subtotalCents, taxCents, totalCents };
  }

  async create(businessId: string, dto: CreateInvoiceDto) {
    const biz = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { taxRatePercent: true, currency: true },
    });

    const taxRate = dto.taxRatePercent ?? biz.taxRatePercent ?? 0;
    const discount = dto.discountCents ?? 0;
    const { lines, subtotalCents, taxCents, totalCents } = this.calcTotals(dto.lineItems, taxRate, discount);

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
          lineItems: lines,
          notes: dto.notes ?? null,
          currency: biz.currency,
          subtotalCents,
          taxRatePercent: taxRate,
          taxCents,
          totalCents,
          discountCents: discount,
          discountLabel: dto.discountLabel ?? null,
          paymentTerms: dto.paymentTerms ?? null,
          poNumber: dto.poNumber ?? null,
          billingAddress: dto.billingAddress ?? null,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        },
        include: { client: { select: { id: true, name: true, email: true, phone: true } } },
      });
    });
  }

  async update(id: string, businessId: string, dto: UpdateInvoiceDto) {
    const existing = await this.get(id, businessId);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT invoices can be edited');
    }

    const biz = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { taxRatePercent: true, currency: true },
    });

    const rawLineItems = dto.lineItems ?? (existing.lineItems as any[]);
    const taxRate = dto.taxRatePercent !== undefined ? (dto.taxRatePercent ?? 0) : (existing.taxRatePercent ?? biz.taxRatePercent ?? 0);
    const discount = dto.discountCents !== undefined ? dto.discountCents : (existing.discountCents ?? 0);
    const { lines, subtotalCents, taxCents, totalCents } = this.calcTotals(rawLineItems, taxRate, discount);

    return this.prisma.invoice.update({
      where: { id },
      data: {
        clientId: dto.clientId !== undefined ? (dto.clientId || null) : undefined,
        lineItems: lines,
        notes: dto.notes !== undefined ? (dto.notes ?? null) : undefined,
        subtotalCents,
        taxRatePercent: taxRate,
        taxCents,
        totalCents,
        discountCents: discount,
        discountLabel: dto.discountLabel !== undefined ? (dto.discountLabel ?? null) : undefined,
        paymentTerms: dto.paymentTerms !== undefined ? (dto.paymentTerms ?? null) : undefined,
        poNumber: dto.poNumber !== undefined ? (dto.poNumber ?? null) : undefined,
        billingAddress: dto.billingAddress !== undefined ? (dto.billingAddress ?? null) : undefined,
        dueAt: dto.dueAt !== undefined ? (dto.dueAt ? new Date(dto.dueAt) : null) : undefined,
      },
      include: { client: { select: { id: true, name: true, email: true, phone: true } } },
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
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        business: { select: { name: true, email: true, phone: true, address: true, taxNumber: true, currency: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async updateStatus(id: string, businessId: string, dto: UpdateInvoiceStatusDto) {
    await this.get(id, businessId);
    return this.prisma.invoice.update({ where: { id }, data: { status: dto.status } });
  }

  async sendByEmail(id: string, businessId: string) {
    const invoice = await this.get(id, businessId);
    if (!invoice.client?.email) {
      throw new BadRequestException('Client has no email address');
    }

    const bizName = invoice.business?.name ?? 'Your Business';
    const currency = (invoice.currency ?? 'CAD').toUpperCase();
    const fmt = (cents: number) =>
      new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(cents / 100);

    const lineRows = (invoice.lineItems as any[])
      .map(
        (li) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB">${li.description}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center">${li.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right">${fmt(li.unitCents)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right">${fmt(li.amountCents)}</td>
        </tr>`,
      )
      .join('');

    const discountRow =
      (invoice.discountCents ?? 0) > 0
        ? `<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#6B7280">${invoice.discountLabel ?? 'Discount'}</td>
             <td style="padding:6px 12px;text-align:right;color:#DC2626">−${fmt(invoice.discountCents ?? 0)}</td></tr>`
        : '';

    const taxRow =
      (invoice.taxCents ?? 0) > 0
        ? `<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#6B7280">Tax (${invoice.taxRatePercent}%)</td>
             <td style="padding:6px 12px;text-align:right">${fmt(invoice.taxCents ?? 0)}</td></tr>`
        : '';

    const poRow = invoice.poNumber
      ? `<p style="margin:4px 0;font-size:13px;color:#6B7280">PO # ${invoice.poNumber}</p>`
      : '';

    const termsRow = invoice.paymentTerms
      ? `<tr><td colspan="4" style="padding:12px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280">
           <strong>Payment Terms:</strong> ${invoice.paymentTerms}</td></tr>`
      : '';

    const billingBlock = invoice.billingAddress
      ? `<div style="margin-top:16px"><p style="margin:0;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Bill To</p>
         <p style="margin:4px 0;font-size:13px;color:#374151;white-space:pre-line">${invoice.billingAddress}</p></div>`
      : '';

    const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 0">
    <tr><td align="center">
      <table width="640" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

        <!-- Header -->
        <tr><td style="background:#E9A23C;padding:28px 32px">
          <table width="100%"><tr>
            <td><h1 style="margin:0;font-size:26px;font-weight:700;color:#FFFFFF">INVOICE</h1>
                <p style="margin:4px 0 0;font-size:14px;color:rgba(255,255,255,.85)">${bizName}</p></td>
            <td align="right" style="vertical-align:top">
              <p style="margin:0;font-size:22px;font-weight:700;color:#FFFFFF">#${invoice.number}</p>
              <p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85)">Status: ${invoice.status}</p>
              ${invoice.dueAt ? `<p style="margin:4px 0 0;font-size:13px;color:rgba(255,255,255,.85)">Due: ${new Date(invoice.dueAt).toLocaleDateString('en-CA')}</p>` : ''}
            </td>
          </tr></table>
        </td></tr>

        <!-- Meta -->
        <tr><td style="padding:24px 32px;border-bottom:1px solid #E5E7EB">
          <table width="100%"><tr>
            <td style="vertical-align:top">
              <p style="margin:0;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Invoice Date</p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827">${new Date(invoice.createdAt).toLocaleDateString('en-CA')}</p>
              ${poRow}
            </td>
            <td align="right" style="vertical-align:top">
              ${invoice.client ? `<p style="margin:0;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Client</p>
              <p style="margin:4px 0 0;font-size:14px;color:#111827">${invoice.client.name}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#6B7280">${invoice.client.email}</p>` : ''}
            </td>
          </tr></table>
          ${billingBlock}
        </td></tr>

        <!-- Line items -->
        <tr><td style="padding:24px 32px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:6px;overflow:hidden">
            <tr style="background:#F9FAFB">
              <th style="padding:10px 12px;text-align:left;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Description</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Unit Price</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Amount</th>
            </tr>
            ${lineRows}
            <tr style="border-top:2px solid #E5E7EB">
              <td colspan="3" style="padding:8px 12px;text-align:right;color:#6B7280;font-size:13px">Subtotal</td>
              <td style="padding:8px 12px;text-align:right;font-size:13px">${fmt(invoice.subtotalCents ?? 0)}</td>
            </tr>
            ${discountRow}
            ${taxRow}
            <tr style="background:#F9FAFB">
              <td colspan="3" style="padding:12px;text-align:right;font-weight:700;font-size:15px;color:#111827">Total (${currency})</td>
              <td style="padding:12px;text-align:right;font-weight:700;font-size:15px;color:#111827">${fmt(invoice.totalCents ?? 0)}</td>
            </tr>
            ${termsRow}
          </table>
        </td></tr>

        ${
          invoice.notes
            ? `<tr><td style="padding:24px 32px 0">
                 <p style="margin:0;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Notes</p>
                 <p style="margin:8px 0 0;font-size:13px;color:#6B7280;white-space:pre-line">${invoice.notes}</p>
               </td></tr>`
            : ''
        }

        <!-- Footer -->
        <tr><td style="padding:28px 32px;border-top:1px solid #E5E7EB;margin-top:24px">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center">
            ${bizName} &bull; ${invoice.business?.email ?? ''} &bull; ${invoice.business?.phone ?? ''}
            ${invoice.business?.address ? `<br>${invoice.business.address}` : ''}
            ${invoice.business?.taxNumber ? `<br>Tax #: ${invoice.business.taxNumber}` : ''}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.email.send({
      to: invoice.client.email,
      subject: `Invoice #${invoice.number} from ${bizName}`,
      html,
    });

    // Mark as SENT if still DRAFT
    if (invoice.status === 'DRAFT') {
      await this.prisma.invoice.update({ where: { id }, data: { status: 'SENT' } });
    }

    return { ok: true, sentTo: invoice.client.email };
  }

  async remove(id: string, businessId: string) {
    await this.get(id, businessId);
    await this.prisma.invoice.delete({ where: { id } });
    return { ok: true };
  }
}
