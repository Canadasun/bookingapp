import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "neutral";

const variants: Record<BadgeVariant, string> = {
  default: "bg-violet-100 text-violet-700",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger:  "bg-red-100 text-red-600",
  neutral: "bg-gray-100 text-gray-600",
};

export function Badge({ variant = "default", className, children }: {
  variant?: BadgeVariant; className?: string; children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
