import type { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service.js";
import { UnauthorizedError } from "../../shared/types/errors.js";
import { success, noContent } from "../../shared/utils/response.js";
import { config } from "../../shared/lib/config.js";
import type { LoginAuth } from "../../shared/lib/schemas.js";
import { asyncHandler } from "../../shared/utils/asyncHandler.js";

export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/",
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
};

export const login = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const input = req.validated!.body as LoginAuth;
  const result = await authService.login(input);

  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

  success(res, {
    accessToken: result.accessToken,
    expiresIn: 3600,
    user: result.user,
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const refreshToken = req.cookies?.refreshToken as string | undefined;

  if (!refreshToken) {
    return next(new UnauthorizedError("Cookie missing, token expired, or token revoked"));
  }

  const result = await authService.refreshToken(refreshToken);

  res.cookie("refreshToken", result.refreshToken, REFRESH_COOKIE_OPTIONS);

  success(res, {
    accessToken: result.accessToken,
    expiresIn: 3600,
  });
});

export const logout = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  const userId = req.user!.userId;
  await authService.logout(userId);

  res.clearCookie("refreshToken", CLEAR_COOKIE_OPTIONS);
  noContent(res);
});

export const me = asyncHandler(async (req: Request, res: Response, _next: NextFunction) => {
  success(res, {
    id: req.user!.userId,
    email: req.user!.email,
    role: req.user!.role,
  });
});