"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BookPageRedirect() {
  const router = useRouter();
  const defaultSlug = process.env.NEXT_PUBLIC_BUSINESS_SLUG;

  useEffect(() => {
    if (defaultSlug) {
      router.replace(`/book/${defaultSlug}`);
    } else {
      router.replace("/");
    }
  }, [router, defaultSlug]);

  return null;
}
