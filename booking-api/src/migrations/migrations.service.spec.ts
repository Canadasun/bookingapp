import { MigrationsService } from './migrations.service';

describe('MigrationsService', () => {
  const request = { id: 'mr1', businessId: 'biz1', sourcePlatform: 'square-appointments' };

  it('stages rows with validation and duplicate detection before writing clients', async () => {
    const createMany = jest.fn().mockResolvedValue({ count: 3 });
    const requestUpdate = jest.fn().mockResolvedValue({});
    const batchCreate = jest.fn().mockResolvedValue({ id: 'batch1' });
    const prisma = {
      migrationRequest: {
        findFirst: jest.fn().mockResolvedValue(request),
        update: requestUpdate,
      },
      client: {
        findMany: jest.fn().mockResolvedValue([{ id: 'existing1', email: 'old@example.com', phone: '+14165550100', name: 'Old Client' }]),
      },
      migrationImportBatch: {
        create: batchCreate,
        findFirst: jest.fn().mockResolvedValue({ id: 'batch1', rows: [] }),
      },
      migrationImportRow: { createMany },
      $transaction: jest.fn().mockImplementation((fn) => fn({
        migrationImportBatch: { create: batchCreate },
        migrationImportRow: { createMany },
        migrationRequest: { update: requestUpdate },
      })),
    };

    const svc = new MigrationsService(prisma as never);
    await svc.stageRows('biz1', 'mr1', {
      fileName: 'square.csv',
      rows: [
        { name: 'New Client', email: 'new@example.com', phone: '4165550101' },
        { name: 'Duplicate Client', email: 'old@example.com' },
        { name: '', email: 'not-an-email' },
      ],
    }, 'user1');

    const stagedRows = createMany.mock.calls[0][0].data;
    expect(stagedRows).toHaveLength(3);
    expect(stagedRows.map((row: { status: string }) => row.status)).toEqual(['VALID', 'DUPLICATE', 'INVALID']);
    expect(stagedRows[1].duplicateClientId).toBe('existing1');
    expect(batchCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ totalRows: 3, validRows: 1, duplicateRows: 1, invalidRows: 1 }),
    }));
    expect(requestUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: { status: 'IN_REVIEW' },
    }));
  });

  it('imports only valid staged rows and leaves invalid rows untouched', async () => {
    const rows = [
      { id: 'row1', status: 'VALID', normalized: { name: 'New Client', email: 'new@example.com', tags: [] }, errors: [] },
      { id: 'row2', status: 'INVALID', normalized: { name: '' }, errors: ['Missing client name'] },
    ];
    const clientCreate = jest.fn().mockResolvedValue({ id: 'client1' });
    const rowUpdate = jest.fn().mockResolvedValue({});
    const batchUpdate = jest.fn().mockResolvedValue({});
    const requestUpdate = jest.fn().mockResolvedValue({});
    const prisma = {
      migrationImportBatch: {
        findFirst: jest.fn()
          .mockResolvedValueOnce({ id: 'batch1', businessId: 'biz1', requestId: 'mr1', status: 'STAGED', rows })
          .mockResolvedValueOnce({ id: 'batch1', status: 'IMPORTED', importedRows: 1, rows: [] }),
        update: batchUpdate,
      },
      client: { create: clientCreate },
      migrationImportRow: { update: rowUpdate },
      migrationRequest: { update: requestUpdate },
      $transaction: jest.fn().mockImplementation((fn) => fn({
        client: { create: clientCreate },
        migrationImportRow: { update: rowUpdate },
        migrationImportBatch: { update: batchUpdate },
        migrationRequest: { update: requestUpdate },
      })),
    };

    const svc = new MigrationsService(prisma as never);
    const result = await svc.confirmImport('biz1', 'batch1');

    expect(clientCreate).toHaveBeenCalledTimes(1);
    expect(clientCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'New Client', email: 'new@example.com' }),
    }));
    expect(rowUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'row1' },
      data: { status: 'IMPORTED', importedClientId: 'client1' },
    }));
    expect(batchUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'IMPORTED', importedRows: 1 }),
    }));
    expect(result.importedRows).toBe(1);
  });
});
