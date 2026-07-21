import { z } from "zod";

export const emailSchema = z.string().trim().email("Invalid email");
export const passwordSchema = z
  .string()
  .trim()
  .min(6, "Password must be at least 6 characters");

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: passwordSchema,
    // userAgent: z.string().optional(),
  })
  .refine((val) => val.password === val.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  userAgent: z.string().optional(),
});
