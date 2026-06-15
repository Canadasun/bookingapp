import { ForbiddenException } from '@nestjs/common';
import { MessagesController } from '../messages/messages.controller';
import { MessagesService } from '../messages/messages.service';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterSchema } from '../auth/dto/auth.dto';
import { BookingsService } from '../bookings/bookings.service';
import { signPublicClientToken, verifyPublicClientToken } from './util/public-client-token';

describe('security regressions', () => {
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeAll(() => { process.env.JWT_SECRET = 'test-public-client-token-secret'; });
  afterAll(() => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;
  });

  it('strips attacker-controlled businessId from public owner registration', () => {
    const parsed = RegisterSchema.parse({
      name: 'Attacker', email: 'attacker@example.com', password: 'password123',
      role: 'OWNER', businessId: 'clw1234567890123456789012',
      privacyConsentAccepted: true,
    });
    expect(parsed).not.toHaveProperty('businessId');
  });

  it('rejects business users trying to forge a client-authored message', async () => {
    const service = { send: jest.fn() };
    const controller = new MessagesController(service as unknown as MessagesService);

    await expect(controller.clientSend(
      'victim-business',
      'victim-client',
      { content: 'Forged client message' },
      undefined,  // appointmentId
      undefined,  // headerToken (x-manage-token)
      undefined,  // queryToken (?token=)
      { id: 'attacker', role: 'OWNER' },
    )).rejects.toThrow(ForbiddenException);
    expect(service.send).not.toHaveBeenCalled();
  });

  it('does not let public booking overwrite an existing client profile', async () => {
    const existing = {
      id: 'client-1', businessId: 'biz-1', name: 'Original Name',
      email: 'client@example.com', phone: '+15550001111', notes: 'Private note',
    };
    const prisma = {
      client: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn(),
        create: jest.fn(),
      },
    };
    const service = new ClientsService(prisma as unknown as PrismaService);

    await expect(service.findOrCreate('biz-1', {
      name: 'Attacker Name', email: 'client@example.com', phone: '+15559999999', notes: 'Overwrite',
    })).resolves.toEqual({ id: 'client-1', businessId: 'biz-1', matched: true });
    expect(prisma.client.update).not.toHaveBeenCalled();
  });

  it('creates an isolated public booking client without looking up an existing profile', async () => {
    const prisma = {
      client: {
        findFirst: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'new-client' }),
      },
    };
    const service = new ClientsService(prisma as unknown as PrismaService);
    const result = await service.createPublicBookingClient('biz-1', {
      name: 'Client', email: 'client@example.com',
    });
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(verifyPublicClientToken(result.clientToken, 'biz-1')).toBe('new-client');
    expect(verifyPublicClientToken(result.clientToken, 'other-business')).toBeNull();
  });

  it('redacts payment, KYC, and private client fields from public appointments', () => {
    const service = new BookingsService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
    const response = service.toPublicAppointment({
      id: 'apt-1', businessId: 'biz-1', staffId: 'staff-1', serviceId: 'svc-1', clientId: 'client-1',
      startsAt: new Date(), endsAt: new Date(), status: 'PENDING', stripePaymentIntentId: 'pi_secret',
      client: { id: 'client-1', name: 'Client', email: 'c@example.com', phone: null, notes: 'private', tags: ['VIP'], stripeCustomerId: 'cus_secret' },
      service: { id: 'svc-1', name: 'Service', description: null, durationMinutes: 60, priceCents: 1000, priceType: 'FLAT' },
      staff: { id: 'staff-1', bio: null, avatarUrl: null, user: { name: 'Owner', email: 'owner@example.com' } },
      business: { id: 'biz-1', name: 'Business', slug: 'business', timezone: 'UTC', currency: 'CAD', stripeConnectAccountId: 'acct_secret', verificationGovernmentIdUrl: '/uploads/secret' },
    }, signPublicClientToken('biz-1', 'client-1')) as any;
    expect(response).not.toHaveProperty('stripePaymentIntentId');
    expect(response.client).not.toHaveProperty('notes');
    expect(response.client).not.toHaveProperty('stripeCustomerId');
    expect(response.business).not.toHaveProperty('stripeConnectAccountId');
    expect(response.business).not.toHaveProperty('verificationGovernmentIdUrl');
  });
});
