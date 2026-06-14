import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../shared/lib/prisma.js";
import { config } from "../../shared/lib/config.js";
import { UnauthorizedError } from "../../shared/types/errors.js";
import type { JwtPayload } from "../../shared/middleware/auth.middleware.js";

interface LoginInput {
  email: string;
  password: string;
}

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRES = "1h";
const REFRESH_TOKEN_EXPIRES = "30d";

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
      throw new UnauthorizedError("Invalid email or password");
    }

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