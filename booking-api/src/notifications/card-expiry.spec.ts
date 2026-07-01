import { cardExpiryInfo } from './notifications.processor';

describe('cardExpiryInfo', () => {
  // A card is valid through the last day of its exp_month.
  it('returns null when the card is more than 30 days from expiry', () => {
    // "now" mid-June; card expires end of December → far away.
    expect(cardExpiryInfo(12, 2026, new Date('2026-06-15T12:00:00Z'))).toBeNull();
  });

  it('flags the 30-day bucket when expiry is within a month', () => {
    // Card expires end of July 2026; now July 5 → ~26 days left.
    const info = cardExpiryInfo(7, 2026, new Date('2026-07-05T12:00:00Z'));
    expect(info?.bucket).toBe(30);
    expect(info?.daysLeft).toBeGreaterThan(7);
    expect(info?.daysLeft).toBeLessThanOrEqual(30);
  });

  it('flags the 7-day bucket in the final week', () => {
    // Card expires end of July 2026; now July 28 → ~3 days left.
    const info = cardExpiryInfo(7, 2026, new Date('2026-07-28T12:00:00Z'));
    expect(info?.bucket).toBe(7);
    expect(info?.daysLeft).toBeLessThanOrEqual(7);
    expect(info?.daysLeft).toBeGreaterThan(0);
  });

  it('flags expired once the exp month has passed', () => {
    // Card expired end of June 2026; now July 5.
    const info = cardExpiryInfo(6, 2026, new Date('2026-07-05T12:00:00Z'));
    expect(info?.bucket).toBe('expired');
    expect(info?.daysLeft).toBeLessThanOrEqual(0);
  });

  it('treats the last day of the exp month as still valid', () => {
    // End of the exp month itself is not yet expired.
    const info = cardExpiryInfo(7, 2026, new Date('2026-07-31T09:00:00Z'));
    expect(info?.bucket).not.toBe('expired');
  });
});
