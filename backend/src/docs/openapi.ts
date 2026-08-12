import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import {
  registerSchema,
  loginSchema,
  verificationEmailSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "../common/validators/auth.validator.js";
import {
  verifyMFASchema,
  verifyMFAForLoginSchema,
} from "../common/validators/mfa.validator.js";
import config from "../config/app.config.js";

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const errorResponseSchema = z.object({
  message: z.string(),
  error: z.string().optional(),
});

const json = (description: string, schema: z.ZodTypeAny) => ({
  description,
  content: { "application/json": { schema } },
});

registry.registerComponent("securitySchemes", "cookieAuth", {
  type: "apiKey",
  in: "cookie",
  name: "accessToken",
});

registry.registerPath({
  method: "post",
  path: "/auth/register",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: registerSchema } } } },
  responses: {
    201: json("User registered, verification email sent", z.object({ message: z.string() })),
    400: json("Validation error or email already in use", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/login",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: loginSchema } } } },
  responses: {
    200: json(
      "Logged in (cookies set), or MFA required",
      z.object({
        message: z.string(),
        mfaRequired: z.boolean().optional(),
        user: z.record(z.any()).nullable().optional(),
      }),
    ),
    400: json("Invalid email or password", errorResponseSchema),
    429: json("Too many attempts, account temporarily locked", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/refresh",
  tags: ["Auth"],
  security: [{ cookieAuth: [] }],
  responses: {
    200: json("Access token refreshed", z.object({ message: z.string() })),
    401: json("Invalid, expired, or reused refresh token", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/verify/email",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: verificationEmailSchema } } } },
  responses: {
    200: json("Email verified", z.object({ message: z.string() })),
    400: json("Invalid or expired verification code", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/verify/email/resend",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: z.object({ email: z.string().email() }) } } },
  },
  responses: {
    200: json("A new verification email was sent if the account exists and isn't already verified", z.object({ message: z.string() })),
    429: json("Too many resend requests for this account", errorResponseSchema),
  },
});

registry.registerPath({
  method: "put",
  path: "/auth/password/change",
  tags: ["Auth"],
  security: [{ cookieAuth: [] }],
  request: { body: { content: { "application/json": { schema: changePasswordSchema } } } },
  responses: {
    200: json("Password changed, other sessions revoked", z.object({ message: z.string() })),
    400: json("Current password is incorrect", errorResponseSchema),
    401: json("Not authenticated", errorResponseSchema),
    429: json("Too many attempts, account temporarily locked", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/password/forgot",
  tags: ["Auth"],
  request: {
    body: { content: { "application/json": { schema: z.object({ email: z.string().email() }) } } },
  },
  responses: {
    200: json("Reset email sent if the account exists", z.object({ message: z.string() })),
    429: json("Too many reset requests for this account", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/password/reset",
  tags: ["Auth"],
  request: { body: { content: { "application/json": { schema: resetPasswordSchema } } } },
  responses: {
    200: json("Password reset, all sessions revoked", z.object({ message: z.string() })),
    404: json("Invalid or expired verification code", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/auth/logout",
  tags: ["Auth"],
  security: [{ cookieAuth: [] }],
  responses: {
    200: json("Logged out", z.object({ message: z.string() })),
    401: json("Not authenticated", errorResponseSchema),
  },
});

registry.registerPath({
  method: "get",
  path: "/mfa/setup",
  tags: ["MFA"],
  security: [{ cookieAuth: [] }],
  responses: {
    200: json(
      "QR code and setup key for an authenticator app",
      z.object({
        message: z.string(),
        qrImageUrl: z.string().optional(),
        secret: z.string().optional(),
      }),
    ),
    401: json("Not authenticated", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/mfa/verify",
  tags: ["MFA"],
  security: [{ cookieAuth: [] }],
  request: { body: { content: { "application/json": { schema: verifyMFASchema } } } },
  responses: {
    200: json(
      "MFA enabled; recovery codes are shown once, here",
      z.object({
        message: z.string(),
        recoveryCodes: z.array(z.string()).optional(),
        userPreferences: z.object({ enable2FA: z.boolean() }),
      }),
    ),
    401: json("Invalid code", errorResponseSchema),
    429: json("Too many attempts", errorResponseSchema),
  },
});

registry.registerPath({
  method: "post",
  path: "/mfa/verify-login",
  tags: ["MFA"],
  request: { body: { content: { "application/json": { schema: verifyMFAForLoginSchema } } } },
  responses: {
    200: json("Logged in (cookies set)", z.object({ message: z.string() })),
    400: json("Invalid TOTP or recovery code", errorResponseSchema),
    429: json("Too many attempts, account temporarily locked", errorResponseSchema),
  },
});

registry.registerPath({
  method: "put",
  path: "/mfa/revoke",
  tags: ["MFA"],
  security: [{ cookieAuth: [] }],
  responses: {
    200: json(
      "MFA disabled",
      z.object({ message: z.string(), userPreferences: z.object({ enable2FA: z.boolean() }) }),
    ),
    401: json("Not authenticated", errorResponseSchema),
  },
});

registry.registerPath({
  method: "get",
  path: "/session/all",
  tags: ["Session"],
  security: [{ cookieAuth: [] }],
  responses: {
    200: json("All active sessions for the current user", z.object({ sessions: z.array(z.record(z.any())) })),
    401: json("Not authenticated", errorResponseSchema),
  },
});

registry.registerPath({
  method: "delete",
  path: "/session/{id}",
  tags: ["Session"],
  security: [{ cookieAuth: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: json("Session revoked", z.object({ message: z.string() })),
    404: json("Session not found", errorResponseSchema),
  },
});

const generator = new OpenApiGeneratorV3(registry.definitions);

export const openApiDocument = generator.generateDocument({
  openapi: "3.0.0",
  info: {
    title: "MERN Authentication API",
    version: "1.0.0",
    description: "Auth, MFA, and session management endpoints.",
  },
  servers: [{ url: config.BASE_PATH }],
});
