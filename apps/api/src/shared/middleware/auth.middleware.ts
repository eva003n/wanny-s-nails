import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { _config } from "../lib/index.js";
import { UnauthorizedError, ForbiddenError } from "../types/errors.js";

export interface JwtPayload {
  userId: string;
  email: string;
  role: string;
}

/**
 * Extract a JWT from the request.
 *
 * The token is resolved from, in order of priority:
 * 1. A signed HTTP-only cookie (`accessToken`) — preferred for browser clients.
 * 2. The `Authorization: Bearer <token>` header — used by APIs, mobile apps, and
 *    external clients (e.g. EventSource which cannot set custom headers).
 *
 * Controllers and services must never parse cookies or headers directly — this
 * centralised helper is the single source of truth for auth extraction.
 */
function extractToken(req: Request): string | undefined {
  // 1. Signed httpOnly cookie (set by `res.cookie()` with a signing secret)
  const cookieToken = req.signedCookies?.accessToken as string | undefined;
  if (cookieToken) return cookieToken;

  // 2. Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return undefined;
}

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError("Missing or invalid authorization header");
    }

    const decoded = jwt.verify(token, _config.JWT_SECRET) as unknown as {userId: string, role: "OWNER" | "STAFF", email: string};
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
    } else {
      next(new UnauthorizedError("Invalid or expired token"));
    }
  }
};

export const requireRole = (...roles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }
    next();
  };
};
