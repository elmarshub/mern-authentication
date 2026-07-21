export const VerificationEnum = {
  EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
} as const;

export type VerificationEnum =
  (typeof VerificationEnum)[keyof typeof VerificationEnum];
