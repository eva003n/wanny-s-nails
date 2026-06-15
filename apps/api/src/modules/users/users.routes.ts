import { Router } from "express";
import { authenticate, requireRole } from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import {
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
} from "./users.controller.js";
import * as usersController from "./users.controller.js";

const router: ReturnType<typeof Router> = Router();

// User management routes require OWNER or ADMIN role
router.use(authenticate, requireRole("OWNER", "ADMIN"));

// GET /users
router.route("/").get(usersController.listUsers);

// POST /users
router
  .route("/")
  .post(validate(createUserSchema), usersController.createUser);

// GET /users/:id
router.route("/:id").get(usersController.getUser);

// PATCH /users/:id
router
  .route("/:id")
  .patch(validate(updateUserSchema), usersController.updateUser);

// DELETE /users/:id
router.route("/:id").delete(usersController.softDeleteUser);

// POST /users/:id/reset-password
router
  .route("/:id/reset-password")
  .post(validate(resetPasswordSchema), usersController.resetPassword);

export { router as usersRoutes };