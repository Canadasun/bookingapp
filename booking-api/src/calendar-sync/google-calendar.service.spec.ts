import { BadRequestException } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';

describe('GoogleCalendarService OAuth state', () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  beforeAll(() => {
    process.env.GOOGLE_CLIENT_ID = 'client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
  });

  afterAll(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
    else process.env.GOOGLE_CLIENT_ID = originalClientId;
    if (originalClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET;
    else process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
  });

  it('stores random state with tenant and initiating user', async () => {
    const redis = { client: { set: jest.fn().mockResolvedValue('OK') } };
    const service = new GoogleCalendarService({} as any, redis as any);

    const result = await service.authUrl('biz-1', 'user-1');

    expect(result.url).toContain(`state=${result.state}`);
    expect(redis.client.set).toHaveBeenCalledWith(
      `oauth:google:${result.state}`,
      JSON.stringify({ businessId: 'biz-1', userId: 'user-1' }),
      'EX', 900, 'NX',
    );
  });

  it('rejects a callback from a browser without the matching state cookie', async () => {
    const redis = { client: { getdel: jest.fn() } };
    const service = new GoogleCalendarService({} as any, redis as any);

    await expect((service as any).consumeState('state-a', 'state-b')).rejects.toThrow(BadRequestException);
    expect(redis.client.getdel).not.toHaveBeenCalled();
  });

  it('atomically consumes state and rejects replay', async () => {
    const redis = {
      client: {
        getdel: jest.fn()
          .mockResolvedValueOnce(JSON.stringify({ businessId: 'biz-1', userId: 'user-1' }))
          .mockResolvedValueOnce(null),
      },
    };
    const service = new GoogleCalendarService({} as any, redis as any);

    await expect((service as any).consumeState('state', 'state')).resolves.toEqual({ businessId: 'biz-1', userId: 'user-1' });
    await expect((service as any).consumeState('state', 'state')).rejects.toThrow(BadRequestException);
  });
});
