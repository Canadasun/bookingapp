import { ForbiddenException } from '@nestjs/common';
import { BookingsController } from '../bookings/bookings.controller';
import { ClientsController } from '../clients/clients.controller';
import { PaymentsController } from '../payments/payments.controller';

describe('tenant isolation guards', () => {
  const ownerA = { id: 'user_a', role: 'OWNER', businessId: 'biz_a' };

  it('blocks cross-business booking calendar access before service execution', () => {
    const service = { findAll: jest.fn() };
    const controller = new BookingsController(service as any);

    expect(() => controller.findAll('biz_b', ownerA, undefined, undefined)).toThrow(ForbiddenException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('blocks cross-business client list access before service execution', () => {
    const service = { findAll: jest.fn() };
    const controller = new ClientsController(service as any);

    expect(() => controller.findAll('biz_b', ownerA, undefined, undefined, undefined)).toThrow(ForbiddenException);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('scopes payment ledger access to the authenticated business, not request-controlled ids', () => {
    const service = { listPayments: jest.fn() };
    const controller = new PaymentsController(service as any);

    controller.list(ownerA);
    expect(service.listPayments).toHaveBeenCalledWith('biz_a');
  });
});
