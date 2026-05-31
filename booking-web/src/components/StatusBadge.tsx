import { Badge } from "@/components/ui/badge";

const STATUS_MAP: Record<string, { label: string; variant: "success" | "warning" | "danger" | "neutral" | "default" }> = {
  CONFIRMED: { label: "Confirmed", variant: "success" },
  PENDING:   { label: "Pending",   variant: "warning" },
  CANCELLED: { label: "Cancelled", variant: "danger" },
  COMPLETED: { label: "Completed", variant: "neutral" },
  NO_SHOW:   { label: "No Show",   variant: "neutral" },
};

export function StatusBadge({ status }: { status: string }) {
  const { label, variant } = STATUS_MAP[status] ?? { label: status, variant: "default" };
  return <Badge variant={variant}>{label}</Badge>;
}
