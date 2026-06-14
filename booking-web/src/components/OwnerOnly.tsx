"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/auth";

export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && user?.role !== "OWNER" && user?.role !== "ADMIN") {
      router.replace("/dashboard/appointments");
    }
  }, [loading, router, user]);

  if (loading || (user?.role !== "OWNER" && user?.role !== "ADMIN")) return null;
  return <>{children}</>;
}
