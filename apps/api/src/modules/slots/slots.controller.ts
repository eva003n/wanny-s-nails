import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { slotsService } from "./slots.service.js";
import { success } from "../../shared/utils/response.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

// --- Validation schemas (exported for use in routes) ---

export const availabilitySchema = z.object({
  serviceId: z.uuid("Invalid UUID"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
});

// --- Handlers ---

export const getAvailability = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.query as z.infer<typeof availabilitySchema>;

 const result = await slotsService.getAvailableSlots(
    input.date,
    input.serviceId,
  );
  
  success(res, result);
});