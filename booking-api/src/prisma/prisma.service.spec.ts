import { scopeTenantArgs } from './prisma.service';

describe('Prisma tenant query scoping', () => {
  it('adds businessId to unique reads instead of changing the Prisma operation', () => {
    const args = scopeTenantArgs('Client', 'findUnique', { where: { id: 'client-1' }, select: { id: true } }, 'biz-1');
    expect(args).toEqual({ where: { id: 'client-1', businessId: 'biz-1' }, select: { id: true } });
  });

  it('scopes unique writes and upserts', () => {
    expect(scopeTenantArgs('Service', 'update', { where: { id: 'svc-1' }, data: { name: 'Cut' } }, 'biz-1').where)
      .toEqual({ id: 'svc-1', businessId: 'biz-1' });
    expect(scopeTenantArgs('Service', 'upsert', {
      where: { id: 'svc-1' }, create: { name: 'Cut' }, update: { name: 'Cut' },
    }, 'biz-1')).toMatchObject({
      where: { id: 'svc-1', businessId: 'biz-1' },
      create: { name: 'Cut', businessId: 'biz-1' },
      update: { name: 'Cut', businessId: 'biz-1' },
    });
  });

  it('overrides attacker-controlled tenant IDs in createMany', () => {
    const args = scopeTenantArgs('Client', 'createMany', {
      data: [{ name: 'A', businessId: 'foreign' }, { name: 'B' }],
    }, 'biz-1');
    expect(args.data).toEqual([
      { name: 'A', businessId: 'biz-1' },
      { name: 'B', businessId: 'biz-1' },
    ]);
  });

  it('does not alter platform-global models', () => {
    const args = { where: { id: 'user-1' } };
    expect(scopeTenantArgs('User', 'findUnique', args, 'biz-1')).toBe(args);
  });
});
