import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { UnauthorizedError, AccountLockedError } from "../../../shared/types/errors.js";
import { success, noContent } from "../../../shared/utils/response.js";
import { _config } from "../../../shared/lib/config.js";
import { asyncHandler } from "../../../shared/utils/asyncHandler.js";
import { z } from "zod";

// Shared (btw frontend and backend)
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});

export type LoginAuth = z.infer<typeof loginSchema>

/** Access token cookie — 1 hour TTL. Also returned in the response body. */
export const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: _config.NODE_ENV === "production",
  sameSite: "strict" as const,
  signed: true,
  maxAge: 60 * 60 * 1000, // 1 hour
  path: "/",
};

/** Refresh token cookie — 7-day TTL. */
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: _config.NODE_ENV === "production",
  sameSite: "strict" as const,
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: "/",
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: _config.NODE_ENV === "production",
  sameSite: "strict" as const,
  signed: true,
  path: "/",
};

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const input = req.validated!.body as LoginAuth;

  try {
    const result = await authService.login(input);

    // Both tokens are set as signed httpOnly cookies.
    // The access token is also returned in the response body for the client to hold in memory.
    res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);
    res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

    success(res, {
      accessToken: result.accessToken,
      expiresIn: 3600,
      user: result.user,
    }, undefined, {type: "no-store"});
  } catch (error) {
    // Expose lockout info so the client can show a countdown
    if (error instanceof AccountLockedError) {
      return next(error);
    }
    next(error);
  }
});

export const refresh = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // The refresh token is stored in a signed httpOnly cookie
  const refreshToken = req.signedCookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    return next(new UnauthorizedError("Cookie missing, token expired, or token revoked"));
  }

  const result = await authService.refreshToken(refreshToken);

  res.cookie("accessToken", result.accessToken, ACCESS_COOKIE_OPTIONS);
  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

  success(res, {
    accessToken: result.accessToken,
    expiresIn: 3600,
  }, undefined, {type: "no-store"});
});

export const logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user!.userId;
  await authService.logout(userId);

  res.clearCookie("accessToken", CLEAR_COOKIE_OPTIONS);
  res.clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS);
  noContent(res);
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(72),
  newPassword: z.string().min(8).max(72),
});

export const changePassword = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.validated!.body as z.infer<typeof changePasswordSchema>;
  await authService.changePassword(userId, currentPassword, newPassword);
  noContent(res);
});

export const me = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = await authService.me({id: req.user.userId});

  if (!user) {
    return next(new UnauthorizedError("User not found"));
  }

  success(res, user, undefined, {type: "private", revalidation: "must-revalidate"});
});
