import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import {
  loginRateLimit,
  refreshRateLimit,
} from "../../shared/middleware/rateLimit.middleware.js";
import * as authController from "./auth.controller.js";
import { loginSchema } from "../../shared/lib/schemas.js";
import { validate } from "../../shared/middleware/validate.middleware.js";

const router: ReturnType<typeof Router> = Router();

// POST /auth/login
router
  .route("/login")
  .post(loginRateLimit, validate(loginSchema), authController.login);

// POST /auth/refresh
router.route("/refresh").post(refreshRateLimit, authController.refresh);

// POST /auth/logout
router.route("/logout").post(authenticate, authController.logout);

// GET /auth/me
router.route("/me").get(authenticate, authController.me);

export { router as authRoutes };