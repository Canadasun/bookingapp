import { GetSlotsSchema } from './availability.dto';

describe('GetSlotsSchema', () => {
  const base = { staffId: 'staff', serviceId: 'service', startDate: '2026-06-01', endDate: '2026-06-30', timezone: 'America/Edmonton' };

  it('accepts a bounded valid range', () => {
    expect(GetSlotsSchema.safeParse(base).success).toBe(true);
  });

  it('rejects excessive ranges, reversed dates, and invalid timezones', () => {
    expect(GetSlotsSchema.safeParse({ ...base, endDate: '2027-06-30' }).success).toBe(false);
    expect(GetSlotsSchema.safeParse({ ...base, endDate: '2026-05-31' }).success).toBe(false);
    expect(GetSlotsSchema.safeParse({ ...base, timezone: 'Not/A_Timezone' }).success).toBe(false);
  });
});
