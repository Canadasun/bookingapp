import { ResourcesService } from './resources.service';

describe('ResourcesService.remove', () => {
  it('archives a resource instead of deleting it when services still reference it', async () => {
    const prisma = {
      resource: {
        findFirst: jest.fn().mockResolvedValue({ id: 'r1', businessId: 'biz1', active: true }),
        update: jest.fn().mockResolvedValue({ id: 'r1', active: false }),
        delete: jest.fn(),
      },
      service: { count: jest.fn().mockResolvedValue(2) },
    };
    const svc = new ResourcesService(prisma as never);

    await expect(svc.remove('r1', 'biz1')).resolves.toEqual({ ok: true, archived: true });
    expect(prisma.resource.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { active: false } });
    expect(prisma.resource.delete).not.toHaveBeenCalled();
  });
});
