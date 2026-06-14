import type { Request, Response, NextFunction } from "express";
import { prisma } from "../../shared/lib/prisma.js";
import { paginated } from "../../shared/utils/response.js";
import { parsePagination } from "../../shared/utils/pagination.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

export const listReminders = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (req.query.status) {
    where.status = req.query.status;
  }

  if (req.query.from || req.query.to) {
    const dateFilter: Record<string, Date> = {};
    if (req.query.from) dateFilter.gte = new Date(req.query.from as string);
    if (req.query.to) dateFilter.lte = new Date(req.query.to as string);
    where.scheduledAt = dateFilter;
  }

  if (req.query.bookingId) {
    where.bookingId = req.query.bookingId;
  }

  const [reminders, total] = await Promise.all([
    prisma.reminder.findMany({
      where,
      include: {
        booking: { select: { id: true, reference: true } },
      },
      orderBy: { scheduledAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.reminder.count({ where }),
  ]);

  paginated(res, reminders, total, page, limit);
});