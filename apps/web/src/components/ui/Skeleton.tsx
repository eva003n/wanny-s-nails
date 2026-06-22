/**
 * §7.1 Loading — Skeletons
 *
 * Match exact height and width of the content they replace.
 * Use animate-pulse with bg-surface-raised.
 * §11: Never use a generic full-page spinner as a loading state.
 */
import { clsx } from "clsx";

interface SkeletonProps {
  className?: string;
  /** Predefined shapes for common content */
  shape?: "text" | "heading" | "circle" | "rect" | "card";
  width?: string | number;
  height?: string | number;
}

const shapeStyles: Record<
  string,
  { width: string; height: string; borderRadius: string }
> = {
  text: { width: "100%", height: "14px", borderRadius: "var(--radius-sm)" },
  heading: { width: "60%", height: "20px", borderRadius: "var(--radius-sm)" },
  circle: { width: "40px", height: "40px", borderRadius: "var(--radius-full)" },
  rect: { width: "100%", height: "80px", borderRadius: "var(--radius-sm)" },
  card: { width: "100%", height: "104px", borderRadius: "var(--radius-md)" },
};

export default function Skeleton({
  className,
  shape = "text",
  width,
  height,
}: SkeletonProps) {
  const shapeStyle = shapeStyles[shape];

  return (
    <div
      aria-hidden="true"
      className={clsx("bg-surface-raised animate-pulse", className)}
      style={{
        width: width ?? shapeStyle.width,
        height: height ?? shapeStyle.height,
        borderRadius: shapeStyle.borderRadius,
      }}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-[--radius-md] bg-surface p-4 shadow-[--shadow-card]">
      <Skeleton className="h-9 w-9 rounded-full" />
      <Skeleton className="h-7 w-20" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}
export function BookingCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-[--radius-md] bg-surface p-4 shadow-[--shadow-card]">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 shrink-0" />
    </div>
  );
}
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
    </div>
  );
}