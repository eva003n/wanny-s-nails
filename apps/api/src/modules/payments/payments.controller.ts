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

export const initiateStkPush = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof stkPushSchema>;
  const result = await paymentsService.initiateStkPush(
    input.bookingId,
    input.phoneNumber,
  );

  success(res, result, 202);
});

export const listPayments = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>);
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
    : result.payments.map((p) => ({ ...p, amountKes: null }));

  paginated(res, payments, result.total, result.page, result.limit);
});

export const getPaymentById = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const payment = await paymentsService.getById(req.params.id as string);
  const isOwner = req.user?.role === "OWNER";
  const result = isOwner ? payment : { ...payment, amountKes: null };
  success(res, result);
});

export const handleMpesaCallback = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await paymentsService.handleCallback(req.body);
  success(res, { ResultCode: 0, ResultDesc: "Accepted" });
});