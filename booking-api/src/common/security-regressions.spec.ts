import { ForbiddenException } from '@nestjs/common';
import { MessagesController } from '../messages/messages.controller';
import { MessagesService } from '../messages/messages.service';
import { ClientsService } from '../clients/clients.service';
import { PrismaService } from '../prisma/prisma.service';

describe('security regressions', () => {
  it('rejects business users trying to forge a client-authored message', async () => {
    const service = { send: jest.fn() };
    const controller = new MessagesController(service as unknown as MessagesService);

    await expect(controller.clientSend(
      'victim-business',
      'victim-client',
      { content: 'Forged client message' },
      undefined,
      undefined,
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
});
