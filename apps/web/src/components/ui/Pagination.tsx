/**
 * Pagination component for list pages.
 *
 * Props:
 *  - page: current 1-indexed page
 *  - totalPages: total number of pages (from API meta)
 *  - onPageChange: (page: number) => void
 *  - limit: current page size
 *  - onLimitChange: (limit: number) => void
 *
 * Renders compact prev/next + page dots + page size selector.
 * Hidden when totalPages <= 1.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "./Button";

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}

const PAGE_SIZES = [10, 20, 50];

function buildPageRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [];
  pages.push(1);
  if (current > 3) pages.push("ellipsis");
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function Pagination({
  page,
  totalPages,
  onPageChange,
  limit = 10,
  onLimitChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = buildPageRange(page, totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {/* Left: page size */}
      {onLimitChange && (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <span>Show</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="rounded-[--radius-md] border border-border bg-surface-raised px-2 py-1.5 text-text-primary focus:border-primary focus:outline-none"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span>per page</span>
        </div>
      )}

      {/* Center: page buttons */}
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <Button
          variant="ghost"
          className="h-9 w-9 p-0"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pages.map((p, idx) =>
          p === "ellipsis" ? (
            <span
              key={`e-${idx}`}
              className="h-9 w-9 flex items-center justify-center text-text-disabled"
              aria-hidden
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "primary" : "secondary"}
              className="h-9 w-9 p-0"
              onClick={() => onPageChange(p)}
              type="button"
              aria-current={p === page ? "page" : undefined}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          className="h-9 w-9 p-0"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
          type="button"
        >
          <ChevronRight className="h-4 w-4"  />
        </Button>
      </nav>
    </div>
  );
}