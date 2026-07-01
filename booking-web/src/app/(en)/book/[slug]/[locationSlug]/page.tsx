import { Suspense } from "react";
import { BookPageInner } from "../page";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default async function LocationBookPage({
  params,
}: {
  params: Promise<{ slug: string; locationSlug: string }>;
}) {
  const { slug, locationSlug } = await params;

  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
      <BookPageInner slug={slug} lockedLocationSlug={locationSlug} />
    </Suspense>
  );
}
