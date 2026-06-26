import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  description?: string;
  action?: ReactNode;
}

export default function EmptyState({
  icon: Icon,
  heading,
  description,
  action,
}: EmptyStateProps) {
  // if (typeof icon === "function") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <Icon className="h-12 w-12 text-text-disabled" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-text-primary">{heading}</h3>
        {description && (
          <p className="max-w-xs text-base text-text-secondary">{description}</p>
        )}
        {action}
      </div>
    );

}
