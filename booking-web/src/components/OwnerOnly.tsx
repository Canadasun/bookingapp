"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = getUser();

  useEffect(() => {
    if (user && user.role !== "OWNER") {
      router.replace("/dashboard/appointments");
    }
  }, [user, router]);

  if (!user || user.role !== "OWNER") return null;
  return <>{children}</>;
}
