import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  value: string;
  label: string;
  tone?: "default" | "warning" | "error";
  onClick?: () => void;
}

const toneText: Record<string, string> = {
  default: "text-text-primary",
  warning: "text-warning",
  error: "text-error",
};

export default function StatCard({ icon: Icon, value, label, tone = "default", onClick }: StatCardProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className="flex flex-col gap-3 rounded-[--radius-md] bg-surface p-4 text-left shadow-[--shadow-card]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-light text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={`text-2xl font-bold ${toneText[tone]}`}>{value}</span>
      <span className="text-sm text-text-secondary">{label}</span>
    </Tag>
  );
}
