import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../shared/lib/prisma.js";
import { redis } from "@wannys-nails/packages"
import { config } from "../../shared/lib/config.js";
import { UnauthorizedError, AccountLockedError } from "../../shared/types/errors.js";
import type { JwtPayload } from "../../shared/middleware/auth.middleware.js";

interface LoginInput {
  email: string;
  password: string;
}

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRES = "1h";
const REFRESH_TOKEN_EXPIRES = "7d";

/** Account lockout after 5 failed attempts in 15 minutes. */
const FAILED_ATTEMPTS_KEY_PREFIX = "auth:failed_attempts:";
const LOCKOUT_KEY_PREFIX = "auth:lockout:";
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_SECONDS = 30 * 60; // 30 minutes
const RATE_WINDOW_SECONDS = 15 * 60; // 15 minutes

function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, config.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
}

function signRefreshToken(userId: string): string {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
}

function extractPayload(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export const authService = {
  async login(input: LoginInput) {
    // --- Check account lockout ---
    const lockoutKey = LOCKOUT_KEY_PREFIX + input.email;
    const lockoutTTL = await redis.auth.ttl(lockoutKey);
    if (lockoutTTL > 0) {
      throw new AccountLockedError(lockoutTTL);
    }

    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedError("Invalid email or password");
    }

    if (!user.isActive) {
      throw new UnauthorizedError("Account is deactivated");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      // Increment failed attempts
      const failedKey = FAILED_ATTEMPTS_KEY_PREFIX + input.email;
      const attempts = await redis.auth.incr(failedKey);
      await redis.auth.expire(failedKey, RATE_WINDOW_SECONDS);

      // Lock account after max attempts
      if (attempts >= MAX_FAILED_ATTEMPTS) {
        await redis.auth.setex(lockoutKey, LOCKOUT_DURATION_SECONDS, "locked");
        await redis.auth.del(failedKey); // reset counter after lockout
        throw new AccountLockedError(LOCKOUT_DURATION_SECONDS);
      }

      throw new UnauthorizedError("Invalid email or password");
    }

    // Successful login — clear failed attempts counter
    const failedKey = FAILED_ATTEMPTS_KEY_PREFIX + input.email;
    await redis.auth.del(failedKey);

    const payload: JwtPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(user.id);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  },

  async refreshToken(token: string) {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as { userId: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user || user.deletedAt || !user.isActive) {
        throw new UnauthorizedError("User not found or inactive");
      }

      const payload: JwtPayload = {
        userId: user.id,
        email: user.email,
        role: user.role,
      };

      const accessToken = signAccessToken(payload);
      const newRefreshToken = signRefreshToken(user.id);

      return { accessToken, refreshToken: newRefreshToken };
    } catch (error) {
      if (error instanceof UnauthorizedError) throw error;
      throw new UnauthorizedError("Invalid refresh token");
    }
  },

  async logout(_userId: string) {
    // Token revocation could be implemented with a Redis blocklist
    // For now, the client discards the tokens
    return;
  },

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError("User not found");

    const isCurrentValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentValid) {
      throw new UnauthorizedError("Current password is incorrect");
    }

    const passwordHash = await this.hashPassword(newPassword);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },

  async createOwner(name: string, email: string, password: string) {
    const passwordHash = await this.hashPassword(password);

    return prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "OWNER",
      },
    });
  },
};
