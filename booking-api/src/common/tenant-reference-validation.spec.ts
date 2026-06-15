import { NotFoundException } from '@nestjs/common';
import { InvoicesService } from '../invoices/invoices.service';
import { ServicesService } from '../services/services.service';
import { StaffService } from '../staff/staff.service';

describe('tenant reference validation', () => {
  it('rejects attaching another tenant client to an invoice', async () => {
    const prisma = { client: { findFirst: jest.fn().mockResolvedValue(null) }, invoice: { create: jest.fn() } };
    const service = new InvoicesService(prisma as any);

    await expect(service.create('biz-1', { clientId: 'foreign', lineItems: [] } as any))
      .rejects.toThrow(NotFoundException);
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects attaching another tenant category to a service', async () => {
    const prisma = { serviceCategory: { findFirst: jest.fn().mockResolvedValue(null) }, service: { create: jest.fn() } };
    const service = new ServicesService(prisma as any);

    await expect(service.create('biz-1', { name: 'Cut', durationMinutes: 30, priceCents: 1000, categoryId: 'foreign' } as any))
      .rejects.toThrow(NotFoundException);
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it('rejects moving staff to another tenant location', async () => {
    const prisma = {
      staff: { findFirst: jest.fn().mockResolvedValue({ id: 'staff-1' }), update: jest.fn() },
      location: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new StaffService(prisma as any);

    await expect(service.update('staff-1', { locationId: 'foreign' }, 'biz-1'))
      .rejects.toThrow(NotFoundException);
    expect(prisma.staff.update).not.toHaveBeenCalled();
  });
});
