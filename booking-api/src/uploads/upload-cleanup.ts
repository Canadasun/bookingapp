import { PrismaService } from '../prisma/prisma.service';
import { deleteObject } from './object-storage';

// Matches both /uploads/:id and /proxy/uploads/:id — the two forms stored in the DB.
const UPLOAD_URL_RE = /\/uploads\/([a-zA-Z0-9_-]+)$/;

function extractUploadId(url: string | null | undefined): string | null {
  if (!url) return null;
  return UPLOAD_URL_RE.exec(url)?.[1] ?? null;
}

// Delete an upload row + its R2 object (if any) identified by its stored URL.
// No-op for non-upload URLs or already-deleted records. Never throws.
export async function deleteUploadByUrl(
  prisma: PrismaService,
  url: string | null | undefined,
): Promise<void> {
  const id = extractUploadId(url);
  if (!id) return;
  try {
    const file = await prisma.uploadedFile.findUnique({ where: { id }, select: { storageKey: true } });
    if (!file) return;
    if (file.storageKey) await deleteObject(file.storageKey);
    await prisma.uploadedFile.delete({ where: { id } });
  } catch {
    // best-effort — never block the caller's main operation
  }
}
