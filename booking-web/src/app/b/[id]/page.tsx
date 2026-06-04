"use client";

import { Suspense, use } from "react";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { BookPageInner } from "@/app/book/[slug]/page";

export default function ShortBusinessBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><LoadingSpinner /></div>}>
      <BookPageInner slug={id} lookup="id" />
    </Suspense>
  );
}
