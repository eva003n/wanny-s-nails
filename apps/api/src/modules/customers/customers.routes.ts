import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import * as customersController from "./customers.controller.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "./customers.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/customers
router.get("/", authenticate, customersController.listCustomers);

// POST /api/v1/customers
router.post("/", authenticate, validate(createCustomerSchema), customersController.createCustomer);

// GET /api/v1/customers/:id
router.get("/:id", authenticate, customersController.getCustomerById);

// PATCH /api/v1/customers/:id
router.patch("/:id", authenticate, validate(updateCustomerSchema), customersController.updateCustomer);

// DELETE /api/v1/customers/:id
router.delete("/:id", authenticate, customersController.deleteCustomer);

// GET /api/v1/customers/:id/bookings
router.get("/:id/bookings", authenticate, customersController.getCustomerBookings);

// GET /api/v1/customers/:id/payments
router.get("/:id/payments", authenticate, customersController.getCustomerPayments);

export { router as customersRoutes };