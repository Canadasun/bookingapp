import { PrismaService } from '../../prisma/prisma.service';

// URL-safe slug from arbitrary text. Mirrors the business-slug pattern used at
// signup (auth.service.ts): lowercase, non-alphanumerics → hyphens, trimmed.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// A branch slug unique within its business. Branch slugs are business-scoped
// (not global like business slugs), so we keep them clean/readable and only add
// a numeric suffix on collision: "downtown", "downtown-2", "downtown-3", …
// `excludeId` lets an update ignore the row's own current slug.
export async function uniqueLocationSlug(
  prisma: PrismaService,
  businessId: string,
  name: string,
  excludeId?: string,
): Promise<string> {
  const base = slugify(name) || 'location';
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`;
    const clash = await prisma.location.findFirst({
      where: {
        businessId,
        slug: candidate,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
}
