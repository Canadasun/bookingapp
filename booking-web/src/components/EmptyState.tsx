import { Calendar, type LucideIcon } from "lucide-react";
import Link from "next/link";

// Shared empty-state primitive. Backward-compatible: `title` (+ optional
// `description`) is all most callers pass. Provide `icon` for a more fitting
// glyph and `action` to turn a dead end into a guided next step.
export function EmptyState({
  title,
  description,
  icon: Icon = Calendar,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-gray-400">
      <Icon className="w-12 h-12 mb-4 opacity-30" />
      <p className="font-medium text-gray-600">{title}</p>
      {description && <p className="text-sm mt-1 max-w-sm">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
