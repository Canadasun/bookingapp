import { describe, expect, it } from 'vitest';
import { PLAN_PRICES, PLAN_ORDER } from '../lib/plans';

describe('plan prices', () => {
  it('are strictly monotonically increasing (Free < Basic < Pro < Unlimited)', () => {
    const prices = PLAN_ORDER.map(p => PLAN_PRICES[p]);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThan(prices[i - 1]);
    }
  });
});
