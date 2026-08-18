/**
 * Notifications Controller
 *
 * Admin-facing endpoints for notification history and management.
 */
import type { Request, Response, NextFunction } from "express";
import { logger } from "../../../shared/lib/index.js";

import { success, paginated, noContent } from "../../../shared/utils/response.js";
import { parsePagination } from "../../../shared/utils/pagination.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import {prisma} from "../../../shared/lib/prisma.js"

const log = logger.child({ module: "notifications.controller" });

// ─── List Notifications ───────────────────────────────────────

export const listNotifications = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    recipientId: req.user!.userId,
    readAt: null
  };

  if (req.query.status) {
    where.status = req.query.status;
  }

  if (req.query.channel) {
    where.channel = req.query.channel;
  }

  if (req.query.type) {
    where.type = req.query.type;
  }

  if (req.query.bookingId) {
    where.bookingId = req.query.bookingId;
  }

  if (req.query.from || req.query.to) {
    const dateFilter: Record<string, Date> = {};
    if (req.query.from) dateFilter.gte = new Date(req.query.from as string);
    if (req.query.to) dateFilter.lte = new Date(req.query.to as string);
    where.createdAt = dateFilter;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      include: {
        booking: { select: { id: true, reference: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where }),
  ]);

  paginated(res, notifications, total, page, limit);
});

// ─── Get Single Notification ──────────────────────────────────

export const getNotification = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id as string },
    include: {
      booking: {
        select: { id: true, reference: true, appointmentAt: true },
      },
    },
  });

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  success(res, notification);
});

// ─── List Dead Letter Notifications ───────────────────────────

export const listDeadLetters = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
  const skip = (page - 1) * limit;

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where: { status: "FAILED" },
      include: {
        booking: { select: { id: true, reference: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.notification.count({ where: { status: "FAILED" } }),
  ]);

  paginated(res, notifications, total, page, limit);
});

// ─── Retry Dead Letter ────────────────────────────────────────

export const retryNotification = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id as string },
  });

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  if (notification.status !== "FAILED") {
    res.status(400).json({ error: "Only dead-letter notifications can be retried" });
    return;
  }

  // Reset status to PENDING so the reconciliation sweep picks it up
  // or enqueue directly
  await prisma.notification.update({
    where: { id: notification.id },
    data: {
      status: "PENDING",
      lastError: null,
      failedAt: null,
    },
  });

  log.info(
    { event: "notification.retry", notificationId: notification.id },
    "Dead-letter notification reset for retry",
  );

  success(res, { message: "Notification queued for retry" });
});

// ─── Mark Notification as Read ────────────────────────────────

export const markAsRead = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id as string },
  });

  if (!notification) {
    res.status(404).json({ error: "Notification not found" });
    return;
  }

  await prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });

  noContent(res);
});

// ─── Unread Count ─────────────────────────────────────────────

export const unreadCount = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const count = await prisma.notification.count({
    where: {
      recipientId: req.user!.userId,
      readAt: null,
    },
  });

  success(res, { count });
});

