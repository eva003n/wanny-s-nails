import { Router } from "express";
import { authenticate, requireRole } from "../../../shared/middleware/auth.middleware.js";
import { stkPushRateLimit } from "../../../shared/middleware/rateLimit.middleware.js";
import { validate } from "../../../shared/middleware/validate.middleware.js";
import { idempotencyMiddleware } from "../../../shared/middleware/idempotency.middleware.js";
import * as paymentsController from "./payments.controller.js";
import { stkPushSchema } from "./payments.controller.js";

const router: ReturnType<typeof Router> = Router();

// POST /api/v1/payments/stk-push
router.post(
  "/stk-push",
  authenticate,
  stkPushRateLimit,
  validate(stkPushSchema),
  paymentsController.initiateStkPush,
);

// GET /api/v1/payments — paginated list
router.get("/", authenticate, validate({query: paymentsController.paymentQuerySchema}), paymentsController.listPayments);

// GET /api/v1/payments/:id
router.get("/:id", authenticate, validate({params: paymentsController.paymentParamSchema}), paymentsController.getPaymentById);

// POST /api/v1/payments/:id/refund (OWNER only)
router.post(
  "/:id/refund",
  authenticate,
  requireRole("OWNER"),
  validate({ params: paymentsController.paymentParamSchema, body: paymentsController.refundPaymentSchema }),
  idempotencyMiddleware,
  paymentsController.refundPayment,
);

// M-Pesa callbacks are handled by POST /api/v1/webhooks/daraja (see webhooks module)

export { router as paymentsRoutes };