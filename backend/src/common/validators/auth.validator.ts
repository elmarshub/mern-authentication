import { z } from "zod";

export const emailSchema = z.string().trim().email("Invalid email");
export const passwordSchema = z
  .string()
  .trim()
  .min(6, "Password must be at least 6 characters");

export const verificationCodeSchema = z.string().trim().min(1).max(50);

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

export const verificationEmailSchema = z.object({
  code: verificationCodeSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  verificationCode: verificationCodeSchema,
});
