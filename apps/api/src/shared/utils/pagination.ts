export interface PaginationParams {
  page: number;
  limit: number;
  sort: string | undefined;
}

export function parsePagination(query: Record<string, unknown>, defaults?: { sort?: string }): PaginationParams {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
  const sort = (query.sort as string) || defaults?.sort;
  return { page, limit, sort };
}

export interface SortOptions {
  orderBy: Record<string, "asc" | "desc">;
}

export function parseSort(sort: string | undefined, allowedFields: string[], defaultSort: string): SortOptions {
  const sortParts = (sort || defaultSort).split(":");
  const field = (sortParts[0] || defaultSort.split(":")[0]) as string;
  const direction = (sortParts[1] || defaultSort.split(":")[1] || "asc") as string;

  const safeField = allowedFields.includes(field) ? field : defaultSort.split(":")[0];
  const safeDirection = direction === "desc" ? "desc" : "asc";

  const orderBy: Record<string, "asc" | "desc"> = {};
  orderBy[safeField!] = safeDirection as "asc" | "desc";
  return { orderBy };
}

export function parseCsvFilter(value: string | undefined): string[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((v) => v.trim()).filter(Boolean);
}
