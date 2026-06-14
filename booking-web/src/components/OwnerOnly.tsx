"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getUser } from "@/lib/auth";

export function OwnerOnly({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "OWNER") {
      router.replace("/dashboard/appointments");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
