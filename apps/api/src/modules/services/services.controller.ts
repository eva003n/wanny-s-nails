import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { servicesService } from "./services.service.js";
import { success, created, noContent } from "../../shared/utils/response.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

// --- Validation schemas (exported for use in routes) ---

export const createServiceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().optional(),
  category: z.enum(["MANICURE", "OVERLAY", "PEDICURE", "ACRYLIC"]),
  durationMinutes: z.number().int().min(15).max(480),
  priceKes: z.number().int().min(1),
  sortOrder: z.number().int().optional(),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  priceKes: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// --- Handlers ---

export const listServices = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const includeInactive =
    req.query.includeInactive === "true" && req.user?.role === "OWNER";
  const services = await servicesService.list(includeInactive);
  success(res, services);
});

export const getService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const service = await servicesService.getById(req.params.id as string);
  success(res, service);
});

export const createService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof createServiceSchema>;
  const service = await servicesService.create(input);
  created(res, service);
});

export const updateService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof updateServiceSchema>;
  const service = await servicesService.update(req.params.id as string, input);
  success(res, service);
});

export const softDeleteService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await servicesService.softDelete(req.params.id as string);
  noContent(res);
});