import bcrypt from "bcryptjs";
import { prisma } from "../../shared/lib/prisma.js";
import { UserNotFoundError, ConflictError } from "../../shared/types/errors.js";

const SALT_ROUNDS = 12;

interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: "OWNER" | "STAFF";
}

interface UpdateUserInput {
  name?: string | undefined;
  email?: string | undefined;
  role?: "OWNER" | "STAFF" | undefined;
  isActive?: boolean | undefined;
}

interface ResetPasswordInput {
  password: string;
}

interface ListUsersOptions {
  page: number;
  limit: number;
  includeInactive: boolean;
}

export const usersService = {
  async list({ page, limit, includeInactive }: ListUsersOptions) {
    const where: Record<string, unknown> = {};
    if (!includeInactive) {
      where.isActive = true;
    }

    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return { items, total, page, limit };
  },

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new UserNotFoundError();
    }

    return user;
  },

  async create(data: CreateUserInput) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existing) {
      throw new ConflictError(
        "EMAIL_ALREADY_EXISTS",
        "A user with this email already exists"
      );
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  },

  async update(id: string, data: UpdateUserInput) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new UserNotFoundError();
    }

    if (data.email && data.email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({
        where: { email: data.email },
      });
      if (emailTaken) {
        throw new ConflictError(
          "EMAIL_ALREADY_EXISTS",
          "A user with this email already exists"
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: data as Record<string, unknown>,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  },

  async resetPassword(id: string, data: ResetPasswordInput) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new UserNotFoundError();
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  },

  async softDelete(id: string) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.deletedAt) {
      throw new UserNotFoundError();
    }

    return prisma.user.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
  },
};