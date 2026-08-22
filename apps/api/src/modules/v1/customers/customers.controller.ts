import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { customersService } from "./customers.service.js";
import {
  success,
  created,
  noContent,
  paginated,
} from "../../../shared/utils/response.js";
import { parsePagination } from "../../../shared/utils/pagination.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";

// --- Validation schemas (exported for use in routes) ---

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string()
    .regex(/^254[17]\d{8}$/, "Invalid Kenyan phone number"),
  email: z.string().email().optional(),
});

export const updateCustomerSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z
    .string()
    .regex(/^254[17]\d{8}$/, "Invalid Kenyan phone number")
    .optional(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const listCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.string().optional(),
  search: z.string().optional(),
});

export const customerBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
});

export const customerPaymentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  status: z.string().optional(),
});

// --- Handlers ---

export const listCustomers = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const { page, limit, sort } = parsePagination(
      req.query as Record<string, unknown>,
      {
        sort: "name:asc",
      },
    );
    const search = req.query.search as string | undefined;

    const result = await customersService.list({ page, limit, sort, search });
    paginated(res, result.customers, result.total, result.page, result.limit);
  },
);

export const createCustomer = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const input = req.validated!.body as z.infer<typeof createCustomerSchema>;
    const customer = await customersService.create({
      name: input.name,
      phone: input.phone,
      email: input.email ?? undefined,
    });
    created(res, customer);
  },
);

export const getCustomerById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const customer = await customersService.getById(params.id);
    success(res, customer);
  },
);

export const updateCustomer = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const input = req.validated!.body as z.infer<typeof updateCustomerSchema>;
    const customer = await customersService.update(
      params.id,
      input,
    );
    success(res, customer);
  },
);

export const deleteCustomer = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    await customersService.softDelete(params.id);
    noContent(res);
  },
);

export const getCustomerBookings = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const query = req.validated?.query as z.infer<typeof customerBookingsQuerySchema> | undefined;
    const { page, limit } = parsePagination(
      req.query as Record<string, unknown>,
    );
    const status = query?.status ?? (req.query.status as string | undefined);
    const result = await customersService.getBookings(params.id, {
      page,
      limit,
      status,
    });
    paginated(res, result.bookings, result.total, result.page, result.limit);
  },
);

export const getCustomerPayments = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction) => {
    const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
    const query = req.validated?.query as z.infer<typeof customerPaymentsQuerySchema> | undefined;
    const { page, limit } = parsePagination(
      req.query as Record<string, unknown>,
    );
    const status = query?.status ?? (req.query.status as string | undefined);
    const result = await customersService.getPayments(params.id, {
      page,
      limit,
      status,
    });
    const isOwner = req.user?.role === "OWNER";
    const payments = isOwner
      ? result.payments
      : result.payments.map((p) => ({ ...p, amountKes: null }));
    paginated(res, payments, result.total, result.page, result.limit);
  },
);
