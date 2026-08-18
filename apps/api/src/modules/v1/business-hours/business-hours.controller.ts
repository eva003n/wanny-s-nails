import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { businessHoursService } from "./business-hours.service.js";
import { success, created } from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";

// --- Validation schemas ---

export const hoursEntrySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  isActive: z.boolean(),
});

export const updateHoursSchema = z.object({
  hours: z.array(hoursEntrySchema).min(1).max(7),
});

// --- Handlers ---

export const getHours = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  // Seed defaults on first access
  await businessHoursService.seedDefaults();
  const hours = await businessHoursService.list();
  success(res, hours);
});

export const updateHours = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof updateHoursSchema>;
  const hours = await businessHoursService.upsertMany(input.hours);
  success(res, hours);
});