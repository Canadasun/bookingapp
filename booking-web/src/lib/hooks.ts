import { useState, useEffect } from "react";
import { getUser } from "./auth";

export function useBusinessId() {
  const [bizId, setBizId] = useState<string>("");

  useEffect(() => {
    const user = getUser();
    if (user?.businessId) {
      setBizId(user.businessId);
    } else {
      // Fallback to env for local dev if not logged in (e.g. initial setup)
      setBizId(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "");
    }
  }, []);

  return bizId;
}
