import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { servicesService } from "./services.service.js";
import { success, created, noContent } from "../../shared/utils/response.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";


// --- Validation schemas (exported for use in routes) ---

export const createServiceSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(72, `Description must be 72 characters or less`).optional(),
  category: z.enum(["MANICURE", "PEDICURE", "ENHANCEMENTS", "NAIL_ART", "EXTENSIONS", "REMOVAL", "REPAIR", "TREATMENT"]),
  durationMinutes: z.number().int().min(15).max(480),
  priceKes: z.number().int().min(1),
  sortOrder: z.number().int().optional(),
});

export const updateServiceSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(72, `Description must be 72 characters or less`).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional(),
  priceKes: z.number().int().min(1).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export const listServicesQuerySchema = z.object({
  includeInactive: z.string().optional(),
});

// --- Handlers ---

export const listServices = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const includeInactive =
    req.query.includeInactive === "true" && req.user?.role === "OWNER";
  const services = await servicesService.list(includeInactive);
  success(res, services);
});

export const getService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const service = await servicesService.getById(params.id);
  success(res, service);
});

export const createService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof createServiceSchema>;
  const service = await servicesService.create(input);
  created(res, service);
});

export const updateService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  const input = req.validated!.body as z.infer<typeof updateServiceSchema>;
  const service = await servicesService.update(params.id, input);
  success(res, service);
});

export const softDeleteService = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const params = req.validated?.params as z.infer<typeof uuidParamSchema>;
  await servicesService.softDelete(params.id);
  noContent(res);
});
