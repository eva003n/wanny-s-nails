import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { usersService } from "./users.service.js";
import { success, created, noContent, paginated } from "../../shared/utils/response.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";
import { parsePagination, parseSort } from "../../shared/utils/pagination.js";

// --- Validation schemas ---

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
  role: z.enum(["OWNER", "STAFF"]).default("STAFF"),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().max(255).optional(),
  role: z.enum(["OWNER", "STAFF"]).optional(),
  isActive: z.boolean().optional(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(72),
});

// --- Handlers ---

export const listUsers = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const { page, limit } = parsePagination(req.query as Record<string, unknown>, {
    sort: "createdAt:desc",
  });
  const includeInactive = req.query.includeInactive === "true";
  const result = await usersService.list({ page, limit, includeInactive });
  paginated(res, result.items, result.total, result.page, result.limit);
});

export const getUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const user = await usersService.getById(req.params.id as string);
  success(res, user);
});

export const createUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof createUserSchema>;
  const user = await usersService.create(input);
  created(res, user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof updateUserSchema>;
  const user = await usersService.update(req.params.id as string, input);
  success(res, user);
});

export const resetPassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as z.infer<typeof resetPasswordSchema>;
  await usersService.resetPassword(req.params.id as string, input);
  noContent(res);
});

export const softDeleteUser = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  await usersService.softDelete(req.params.id as string);
  noContent(res);
});