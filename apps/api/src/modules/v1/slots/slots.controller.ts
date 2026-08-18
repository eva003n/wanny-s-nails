import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { slotsService } from "./slots.service.js";
import { success } from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";

// --- Validation schemas (exported for use in routes) ---

export const availabilitySchema = z.object({
  serviceIds: z.string(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  timePeriod: z.enum(["morning", "afternoon", "evening"]).optional(),
});

// --- Handlers ---

export const getAvailability = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.query as z.infer<typeof availabilitySchema>;

  if (input.timePeriod) {
    const result = await slotsService.getRecommendedSlots(
      input.date,
      input.serviceIds,
      input.timePeriod,
    );
    success(res, result);
  } else {
    const result = await slotsService.getAvailableSlots(
      input.date,
      input.serviceIds,
    );
    success(res, result);
  }
});
