import type { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function success(
  res: Response,
  data: unknown,
  status = 200,
  cache?: {
    type: "private" | "no-cache" | "no-store";
    maxAgeSec?: number;
    revalidation?: "must-revalidate" | "immutable";
  },
) {
  
   const maxAgeSec = 0;
  if (cache) {
    if (cache.type === "no-store") {
      res.set({
        "Cache-Control": `${cache?.type}`,
      });
    } else {
      res.set({
        "Cache-Control": `${cache?.type} max-age=${cache?.maxAgeSec || maxAgeSec} ${cache?.revalidation || ""}`,
      });
    }
  }

  res.status(status).json({ data });
}

export function successWithMeta(
  res: Response,
  data: unknown,
  meta: PaginationMeta,
  status = 200,
) {
  res.status(status).json({ data, meta });
}

export function paginated(
  res: Response,
  data: unknown[],
  total: number,
  page: number,
  limit: number,
  status = 200,
) {
  const totalPages = Math.ceil(total / limit);
  const meta: PaginationMeta = {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
  res.status(status).json({ data, meta });
}

export function created(res: Response, data: unknown) {
  res.status(201).json({ data });
}

export function noContent(res: Response) {
  res.status(204).send();
}
