import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizePhone } from '../common/util/phone';
import { CreateMigrationRequestDto, StageMigrationRowsDto } from './dto/migration.dto';

type NormalizedClientRow = {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags: string[];
};

function jsonSafe<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function migrationEnabled() {
  return process.env.MIGRATION_IMPORTS_ENABLED !== 'false';
}

function normalizeEmail(value: unknown) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) return undefined;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined;
}

function splitTags(value: unknown) {
  return String(value ?? '')
    .split(/[;,]/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
}

@Injectable()
export class MigrationsService {
  constructor(private prisma: PrismaService) {}

  private assertEnabled() {
    if (!migrationEnabled()) throw new ForbiddenException('Migration imports are not enabled yet.');
  }

  listRequests(businessId: string) {
    this.assertEnabled();
    return this.prisma.migrationRequest.findMany({
      where: { businessId },
      include: { batches: { orderBy: { createdAt: 'desc' }, take: 5 } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  createRequest(businessId: string, dto: CreateMigrationRequestDto, userId?: string) {
    this.assertEnabled();
    return this.prisma.migrationRequest.create({
      data: {
        businessId,
        sourcePlatform: dto.sourcePlatform,
        mode: dto.mode,
        approximateSize: dto.approximateSize,
        requestedHelp: dto.requestedHelp ?? dto.mode !== 'SELF_SERVICE',
        notes: dto.notes,
        status: dto.sourcePlatform === 'starting-fresh' ? 'CANCELLED' : 'SUBMITTED',
        createdByUserId: userId,
      },
    });
  }

  async getRequest(businessId: string, id: string) {
    this.assertEnabled();
    const request = await this.prisma.migrationRequest.findFirst({
      where: { id, businessId },
      include: {
        batches: {
          include: { rows: { orderBy: { rowNumber: 'asc' }, take: 100 } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!request) throw new NotFoundException('Migration request not found');
    return request;
  }

  private normalizeRow(row: Record<string, unknown>): { normalized: NormalizedClientRow; errors: string[]; warnings: string[] } {
    const name = String(row.name ?? row['full name'] ?? row.fullName ?? '').trim();
    const emailRaw = row.email ?? row['email address'];
    const phoneRaw = row.phone ?? row.mobile ?? row['phone number'] ?? row['mobile phone'];
    const email = normalizeEmail(emailRaw);
    const phone = phoneRaw ? normalizePhone(String(phoneRaw)) ?? undefined : undefined;
    const notes = String(row.notes ?? row.note ?? '').trim().slice(0, 2000) || undefined;
    const tags = splitTags(row.tags ?? row.tag);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!name) errors.push('Missing client name');
    if (String(emailRaw ?? '').trim() && !email) errors.push('Invalid email address');
    if (String(phoneRaw ?? '').trim() && !phone) warnings.push('Phone number could not be normalized');
    if (!email && !phone) warnings.push('No email or valid phone number');

    return {
      normalized: { name: name.slice(0, 120), email, phone, notes, tags },
      errors,
      warnings,
    };
  }

  async stageRows(businessId: string, requestId: string, dto: StageMigrationRowsDto, userId?: string) {
    this.assertEnabled();
    const request = await this.prisma.migrationRequest.findFirst({ where: { id: requestId, businessId } });
    if (!request) throw new NotFoundException('Migration request not found');
    if (request.sourcePlatform === 'starting-fresh') throw new BadRequestException('No migration is needed for starting fresh.');

    const existingClients = await this.prisma.client.findMany({
      where: { businessId },
      select: { id: true, email: true, phone: true, name: true },
    });
    const byEmail = new Map(existingClients.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c.id]));
    const byPhone = new Map<string, string>();
    for (const client of existingClients) {
      if (!client.phone) continue;
      const phone = normalizePhone(client.phone);
      if (phone) byPhone.set(phone, client.id);
    }

    let validRows = 0;
    let invalidRows = 0;
    let duplicateRows = 0;
    const rows = dto.rows.map((row, index) => {
      const { normalized, errors, warnings } = this.normalizeRow(row);
      const duplicateClientId =
        (normalized.email ? byEmail.get(normalized.email) : undefined) ??
        (normalized.phone ? byPhone.get(normalized.phone) : undefined);
      const status = errors.length ? 'INVALID' : duplicateClientId ? 'DUPLICATE' : 'VALID';
      if (status === 'VALID') validRows++;
      else if (status === 'INVALID') invalidRows++;
      else duplicateRows++;
      return {
        businessId,
        rowNumber: index + 1,
        status,
        raw: jsonSafe(row),
        normalized: jsonSafe(normalized),
        errors,
        warnings,
        duplicateClientId,
      };
    });

    const totalRows = rows.length;
    const confidenceScore = totalRows === 0
      ? 0
      : Math.max(0, Math.round(((validRows + duplicateRows * 0.5) / totalRows) * 100));

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.migrationImportBatch.create({
        data: {
          businessId,
          requestId,
          sourcePlatform: dto.sourcePlatform ?? request.sourcePlatform,
          fileName: dto.fileName,
          totalRows,
          validRows,
          invalidRows,
          duplicateRows,
          confidenceScore,
          createdByUserId: userId,
          summary: {
            detectedClients: totalRows,
            validRows,
            invalidRows,
            duplicateRows,
          },
        },
      });
      await tx.migrationImportRow.createMany({
        data: rows.map((row) => ({ ...row, batchId: created.id })),
      });
      await tx.migrationRequest.update({
        where: { id: request.id },
        data: { status: invalidRows > 0 || duplicateRows > 0 ? 'IN_REVIEW' : 'READY_TO_IMPORT' },
      });
      return created;
    });

    return this.getBatch(businessId, batch.id);
  }

  async getBatch(businessId: string, batchId: string) {
    const batch = await this.prisma.migrationImportBatch.findFirst({
      where: { id: batchId, businessId },
      include: { rows: { orderBy: { rowNumber: 'asc' }, take: 1000 } },
    });
    if (!batch) throw new NotFoundException('Migration import batch not found');
    return batch;
  }

  async confirmImport(businessId: string, batchId: string) {
    this.assertEnabled();
    const batch = await this.prisma.migrationImportBatch.findFirst({
      where: { id: batchId, businessId },
      include: { rows: { orderBy: { rowNumber: 'asc' } } },
    });
    if (!batch) throw new NotFoundException('Migration import batch not found');
    if (batch.status === 'IMPORTED') throw new BadRequestException('This batch has already been imported.');

    let importedRows = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const row of batch.rows) {
        if (row.status !== 'VALID') continue;
        const normalized = row.normalized as NormalizedClientRow;
        const created = await tx.client.create({
          data: {
            businessId,
            name: normalized.name,
            email: normalized.email,
            phone: normalized.phone,
            notes: normalized.notes,
            tags: normalized.tags ?? [],
          },
        }).catch(async (err) => {
          if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            await tx.migrationImportRow.update({
              where: { id: row.id },
              data: { status: 'DUPLICATE', errors: [...row.errors, 'Client already exists'] },
            });
            return null;
          }
          throw err;
        });
        if (!created) continue;
        importedRows++;
        await tx.migrationImportRow.update({
          where: { id: row.id },
          data: { status: 'IMPORTED', importedClientId: created.id },
        });
      }
      await tx.migrationImportBatch.update({
        where: { id: batch.id },
        data: { status: 'IMPORTED', importedRows, importedAt: new Date() },
      });
      if (batch.requestId) {
        await tx.migrationRequest.update({ where: { id: batch.requestId }, data: { status: 'IMPORTED' } });
      }
    });

    return this.getBatch(businessId, batchId);
  }
}
