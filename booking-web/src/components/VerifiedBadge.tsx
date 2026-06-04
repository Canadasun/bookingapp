import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// A standout "Verified" badge shown once a platform admin approves a business's
// verification. Gradient pill so it reads as a trust signal to clients.
export function VerifiedBadge({ className, size = "sm", label = "Verified" }: {
  className?: string;
  size?: "sm" | "md";
  label?: string;
}) {
  return (
    <span
      title="Identity verified by Pulse"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-sky-500 to-violet-600 font-semibold text-white shadow-sm ring-1 ring-white/30",
        size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      <BadgeCheck className={size === "md" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {label}
    </span>
  );
}
