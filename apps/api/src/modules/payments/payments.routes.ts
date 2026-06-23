import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { stkPushRateLimit } from "../../shared/middleware/rateLimit.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
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

// POST /api/v1/payments/mpesa-callback — public, validated by IP
router.post("/stk-callback", paymentsController.handleMpesaCallback);

export { router as paymentsRoutes };