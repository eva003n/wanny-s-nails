import {z}  from "zod";

// Shared (btw frontend and backend)
export const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(72),
});

export type LoginAuth = z.infer<typeof loginSchema>
