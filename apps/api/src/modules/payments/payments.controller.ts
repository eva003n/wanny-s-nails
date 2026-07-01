import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { paymentsService } from "./payments.service.js";
import { success, paginated } from "../../shared/utils/response.js";
import { parsePagination } from "../../shared/utils/pagination.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

// --- Validation schemas (exported for use in routes) ---

export const stkPushSchema = z.object({
  bookingId: z.string().uuid(),
  phoneNumber: z
    .string()
    .regex(/^\+254[17]\d{8}$/, "Invalid Kenyan phone number"),
});

// --- Handlers ---

export const initiateStkPush = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.validated!.body as z.infer<typeof stkPushSchema>;
    const result = await paymentsService.initiateStkPush(
      input.bookingId,
      input.phoneNumber,
    );

    success(res, result, 202);
  },
);

export const paymentQuerySchema = z.object({
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  customerId: z.string().optional(),
})
export const listPayments = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { page, limit } = parsePagination(
      req.query as Record<string, unknown>,
    );
    const result = await paymentsService.list({
      page,
      limit,
      status: req.query.status as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      customerId: req.query.customerId as string | undefined,
    });

    const isOwner = req.user?.role === "OWNER";
    const payments = isOwner
      ? result.payments
      : result.payments.map((p: any) => ({ ...p, amountKes: null }));

    paginated(res, payments, result.total, result.page, result.limit);
  },
);

export const paymentParamSchema = z.object({
  id: z.string().uuid(),
})
export const getPaymentById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof paymentParamSchema>;
    const payment = await paymentsService.getById(params.id);
    const isOwner = req.user?.role === "OWNER";
    const result = isOwner ? payment : { ...payment, amountKes: null };
    success(res, result);
  },
);

// Callback handling is now in webhooks.controller.ts::handleDaraja
// This endpoint is deprecated — all MPesa callbacks go through
// POST /api/v1/webhooks/daraja
