import { BadRequestException } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';

describe('PromoCodesService.update', () => {
  it('rejects changing a large flat discount into an invalid percentage discount', async () => {
    const prisma = {
      promoCode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'pc1',
          businessId: 'biz1',
          code: 'BIG',
          discountType: 'FLAT',
          discountValue: 1000,
        }),
        update: jest.fn(),
      },
    };
    const svc = new PromoCodesService(prisma as never);

    await expect(svc.update('biz1', 'pc1', { discountType: 'PERCENT' }))
      .rejects.toThrow(BadRequestException);
    expect(prisma.promoCode.update).not.toHaveBeenCalled();
  });
});
