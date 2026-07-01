import { InvoicesService } from './invoices.service';

// Per-location tax resolution (Phase A1): an invoice for a branch collects that
// branch's Canadian rate; otherwise the business rate; an explicit rate wins.
describe('InvoicesService — per-location tax', () => {
  function build(opts: { businessRate: number; locationRate?: number | null }) {
    const invoiceCreate = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'inv1', ...data }));
    const prisma = {
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client1' }) },
      business: { findUniqueOrThrow: jest.fn().mockResolvedValue({ taxRatePercent: opts.businessRate, currency: 'CAD' }) },
      location: { findFirst: jest.fn().mockResolvedValue(
        opts.locationRate === undefined ? { id: 'loc1' } : { id: 'loc1', taxRatePercent: opts.locationRate },
      ) },
      invoice: { create: invoiceCreate },
      $transaction: jest.fn().mockImplementation(async (fn: any) => fn({
        business: { update: jest.fn().mockResolvedValue({ invoiceSeq: 1 }) },
        invoice: { create: invoiceCreate },
      })),
    };
    return { svc: new InvoicesService(prisma as any), invoiceCreate };
  }

  const line = [{ description: 'Service', quantity: 1, unitCents: 10000 }]; // $100.00

  it("uses the branch's own tax rate when set", async () => {
    const { svc, invoiceCreate } = build({ businessRate: 13, locationRate: 12 }); // ON biz, BC branch
    await svc.create('biz1', { locationId: 'loc1', lineItems: line } as any);
    const data = invoiceCreate.mock.calls[0][0].data;
    expect(data.taxRatePercent).toBe(12);
    expect(data.taxCents).toBe(1200); // 12% of $100
    expect(data.locationId).toBe('loc1');
  });

  it('falls back to the business rate when the branch has no rate', async () => {
    const { svc, invoiceCreate } = build({ businessRate: 13, locationRate: null });
    await svc.create('biz1', { locationId: 'loc1', lineItems: line } as any);
    expect(invoiceCreate.mock.calls[0][0].data.taxRatePercent).toBe(13);
  });

  it('lets an explicit rate override the branch rate', async () => {
    const { svc, invoiceCreate } = build({ businessRate: 13, locationRate: 12 });
    await svc.create('biz1', { locationId: 'loc1', taxRatePercent: 0, lineItems: line } as any);
    expect(invoiceCreate.mock.calls[0][0].data.taxRatePercent).toBe(0);
    expect(invoiceCreate.mock.calls[0][0].data.taxCents).toBe(0);
  });

  it('uses the business rate when no location is given', async () => {
    const { svc, invoiceCreate } = build({ businessRate: 13 });
    await svc.create('biz1', { lineItems: line } as any);
    expect(invoiceCreate.mock.calls[0][0].data.taxRatePercent).toBe(13);
  });
});
