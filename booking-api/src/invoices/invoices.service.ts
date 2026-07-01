import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ResendEmailProvider } from '../notifications/providers/email.provider';
import { CreateInvoiceDto, UpdateInvoiceDto, UpdateInvoiceStatusDto } from './dto/invoice.dto';

@Injectable()
export class InvoicesService {
  private email = new ResendEmailProvider();

  constructor(private prisma: PrismaService) {}

  private async assertClientOwnership(businessId: string, clientId?: string | null) {
    if (!clientId) return;
    const client = await this.prisma.client.findFirst({
      where: { id: clientId, businessId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Client not found');
  }

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

  // The tax rate for an invoice: an explicit rate wins; otherwise the branch's
  // own Canadian rate (a BC branch collects BC tax); otherwise the business rate.
  private async resolveTaxRate(businessId: string, locationId: string | null | undefined, explicit: number | null | undefined, businessRate: number): Promise<number> {
    if (explicit !== undefined) return explicit ?? 0;
    if (locationId) {
      const loc = await this.prisma.location.findFirst({
        where: { id: locationId, businessId },
        select: { taxRatePercent: true },
      });
      if (loc?.taxRatePercent != null) return loc.taxRatePercent;
    }
    return businessRate ?? 0;
  }

  async create(businessId: string, dto: CreateInvoiceDto) {
    await this.assertClientOwnership(businessId, dto.clientId);
    const biz = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { taxRatePercent: true, currency: true },
    });
    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({ where: { id: dto.locationId, businessId }, select: { id: true } });
      if (!loc) throw new NotFoundException('Location not found');
    }

    const taxRate = await this.resolveTaxRate(businessId, dto.locationId, dto.taxRatePercent, biz.taxRatePercent);
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
          locationId: dto.locationId || null,
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
    await this.assertClientOwnership(businessId, dto.clientId);

    const biz = await this.prisma.business.findUniqueOrThrow({
      where: { id: businessId },
      select: { taxRatePercent: true, currency: true },
    });

    if (dto.locationId) {
      const loc = await this.prisma.location.findFirst({ where: { id: dto.locationId, businessId }, select: { id: true } });
      if (!loc) throw new NotFoundException('Location not found');
    }
    const rawLineItems = dto.lineItems ?? (existing.lineItems as any[]);
    // Re-resolve the rate when the branch changes (and no explicit rate is given),
    // otherwise keep the explicit/existing rate.
    const effectiveLocationId = dto.locationId !== undefined ? dto.locationId : existing.locationId;
    const taxRate = dto.taxRatePercent !== undefined
      ? (dto.taxRatePercent ?? 0)
      : dto.locationId !== undefined
        ? await this.resolveTaxRate(businessId, effectiveLocationId, undefined, biz.taxRatePercent)
        : (existing.taxRatePercent ?? biz.taxRatePercent ?? 0);
    const discount = dto.discountCents !== undefined ? dto.discountCents : (existing.discountCents ?? 0);
    const { lines, subtotalCents, taxCents, totalCents } = this.calcTotals(rawLineItems, taxRate, discount);

    return this.prisma.invoice.update({
      where: { id, businessId },
      data: {
        clientId: dto.clientId !== undefined ? (dto.clientId || null) : undefined,
        locationId: dto.locationId !== undefined ? (dto.locationId || null) : undefined,
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
    const invoice = await this.get(id, businessId);
    if (
      (invoice.status === 'PAID' || invoice.status === 'VOID') &&
      (dto.status === 'DRAFT' || dto.status === 'SENT')
    ) {
      throw new BadRequestException(`A ${invoice.status} invoice cannot be reverted to ${dto.status}`);
    }
    return this.prisma.invoice.update({ where: { id, businessId }, data: { status: dto.status } });
  }

  async sendByEmail(id: string, businessId: string) {
    const invoice = await this.get(id, businessId);
    if (!invoice.client?.email) {
      throw new BadRequestException('Client has no email address');
    }

    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    const bizNameRaw = invoice.business?.name ?? 'Your Business';
    const bizName = esc(bizNameRaw);
    const currency = (invoice.currency ?? 'CAD').toUpperCase();
    const fmt = (cents: number) =>
      new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(cents / 100);

    const lineRows = (invoice.lineItems as any[])
      .map(
        (li) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB">${esc(String(li.description ?? ''))}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:center">${li.quantity}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right">${fmt(li.unitCents)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;text-align:right">${fmt(li.amountCents)}</td>
        </tr>`,
      )
      .join('');

    const discountRow =
      (invoice.discountCents ?? 0) > 0
        ? `<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#6B7280">${esc(invoice.discountLabel ?? 'Discount')}</td>
             <td style="padding:6px 12px;text-align:right;color:#DC2626">−${fmt(invoice.discountCents ?? 0)}</td></tr>`
        : '';

    const taxRow =
      (invoice.taxCents ?? 0) > 0
        ? `<tr><td colspan="3" style="padding:6px 12px;text-align:right;color:#6B7280">Tax (${invoice.taxRatePercent}%)</td>
             <td style="padding:6px 12px;text-align:right">${fmt(invoice.taxCents ?? 0)}</td></tr>`
        : '';

    const poRow = invoice.poNumber
      ? `<p style="margin:4px 0;font-size:13px;color:#6B7280">PO # ${esc(invoice.poNumber ?? '')}</p>`
      : '';

    const termsRow = invoice.paymentTerms
      ? `<tr><td colspan="4" style="padding:12px;background:#F9FAFB;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280">
           <strong>Payment Terms:</strong> ${esc(invoice.paymentTerms ?? '')}</td></tr>`
      : '';

    const billingBlock = invoice.billingAddress
      ? `<div style="margin-top:16px"><p style="margin:0;font-size:12px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:.05em">Bill To</p>
         <p style="margin:4px 0;font-size:13px;color:#374151;white-space:pre-line">${esc(invoice.billingAddress)}</p></div>`
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
              <p style="margin:4px 0 0;font-size:14px;color:#111827">${esc(invoice.client.name)}</p>
              <p style="margin:2px 0 0;font-size:13px;color:#6B7280">${esc(invoice.client.email)}</p>` : ''}
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
                 <p style="margin:8px 0 0;font-size:13px;color:#6B7280;white-space:pre-line">${esc(invoice.notes)}</p>
               </td></tr>`
            : ''
        }

        <!-- Footer -->
        <tr><td style="padding:28px 32px;border-top:1px solid #E5E7EB;margin-top:24px">
          <p style="margin:0;font-size:12px;color:#9CA3AF;text-align:center">
            ${bizName} &bull; ${esc(invoice.business?.email ?? '')} &bull; ${esc(invoice.business?.phone ?? '')}
            ${invoice.business?.address ? `<br>${esc(invoice.business.address)}` : ''}
            ${invoice.business?.taxNumber ? `<br>Tax #: ${esc(invoice.business.taxNumber)}` : ''}
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    await this.email.send({
      to: invoice.client.email,
      subject: `Invoice #${invoice.number} from ${bizNameRaw}`,
      html,
    });

    // Mark as SENT if still DRAFT
    if (invoice.status === 'DRAFT') {
      await this.prisma.invoice.update({ where: { id, businessId: invoice.businessId }, data: { status: 'SENT' } });
    }

    return { ok: true, sentTo: invoice.client.email };
  }

  async remove(id: string, businessId: string) {
    await this.get(id, businessId);
    await this.prisma.invoice.delete({ where: { id, businessId } });
    return { ok: true };
  }
}
