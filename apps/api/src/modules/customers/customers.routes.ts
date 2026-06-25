import { Router } from "express";
import { authenticate } from "../../shared/middleware/auth.middleware.js";
import { validate } from "../../shared/middleware/validate.middleware.js";
import * as customersController from "./customers.controller.js";
import {
  createCustomerSchema,
  updateCustomerSchema,
  uuidParamSchema,
  listCustomersQuerySchema,
  customerBookingsQuerySchema,
  customerPaymentsQuerySchema,
} from "./customers.controller.js";

const router: ReturnType<typeof Router> = Router();

// GET /api/v1/customers
router.get("/", authenticate, validate({ query: listCustomersQuerySchema }), customersController.listCustomers);

// POST /api/v1/customers
router.post("/", authenticate, validate(createCustomerSchema), customersController.createCustomer);

// GET /api/v1/customers/:id
router.get("/:id", authenticate, validate({ params: uuidParamSchema }), customersController.getCustomerById);

// PATCH /api/v1/customers/:id
router.patch("/:id", authenticate, validate({ params: uuidParamSchema, body: updateCustomerSchema }), customersController.updateCustomer);

// DELETE /api/v1/customers/:id
router.delete("/:id", authenticate, validate({ params: uuidParamSchema }), customersController.deleteCustomer);

// GET /api/v1/customers/:id/bookings
router.get("/:id/bookings", authenticate, validate({ params: uuidParamSchema, query: customerBookingsQuerySchema }), customersController.getCustomerBookings);

// GET /api/v1/customers/:id/payments
router.get("/:id/payments", authenticate, validate({ params: uuidParamSchema, query: customerPaymentsQuerySchema }), customersController.getCustomerPayments);

export { router as customersRoutes };
