import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "../../src/modules/auth/auth.service.js";
import UserModel from "../../src/database/models/user.model.js";
import SessionModel from "../../src/database/models/session.model.js";
import VerificationModel from "../../src/database/models/verification.js";
import { sendEmail } from "../../src/mailers/mailer.js";
import { signJwtToken, refreshTokenSignOptions } from "../../src/common/utils/jwt.js";
import { ONE_DAY_IN_MS } from "../../src/common/utils/date-time.js";

vi.mock("../../src/database/models/user.model.js", () => ({
  default: {
    exists: vi.fn(),
    create: vi.fn(),
    findOne: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    findByIdAndDelete: vi.fn(),
  },
}));

vi.mock("../../src/database/models/session.model.js", () => ({
  default: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findOneAndDelete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("../../src/database/models/verification.js", () => ({
  default: {
    create: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findOneAndDelete: vi.fn(),
    countDocuments: vi.fn(),
  },
}));

vi.mock("../../src/mailers/mailer.js", () => ({
  sendEmail: vi.fn(),
}));

const makeFakeUser = (overrides: Record<string, any> = {}) => ({
  _id: "user123",
  email: "user@example.com",
  failedLoginAttempts: 0,
  lockUntil: undefined,
  userPreferences: { enable2FA: false },
  comparePassword: vi.fn().mockResolvedValue(true),
  save: vi.fn().mockResolvedValue(undefined),
  ...overrides,
});

describe("AuthService", () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService();
  });

  describe("register", () => {
    it("creates a user and sends a verification email", async () => {
      vi.mocked(UserModel.exists).mockResolvedValue(null);
      vi.mocked(UserModel.create).mockResolvedValue({ _id: "u1", email: "a@b.com" } as any);
      vi.mocked(VerificationModel.create).mockResolvedValue({ _id: "v1", code: "CODE1" } as any);
      vi.mocked(sendEmail).mockResolvedValue({ data: { id: "email1" }, error: null } as any);

      const result = await authService.register({
        name: "A",
        email: "a@b.com",
        password: "password123",
        confirmPassword: "password123",
      });

      expect(result.user.email).toBe("a@b.com");
      expect(sendEmail).toHaveBeenCalledOnce();
    });

    it("rejects when the email already exists, without creating a user", async () => {
      vi.mocked(UserModel.exists).mockResolvedValue({ _id: "existing" } as any);

      await expect(
        authService.register({ name: "A", email: "a@b.com", password: "password123", confirmPassword: "password123" }),
      ).rejects.toThrow(/already exists/i);

      expect(UserModel.create).not.toHaveBeenCalled();
    });

    it("rolls back the created user and verification code when the email fails to send", async () => {
      vi.mocked(UserModel.exists).mockResolvedValue(null);
      vi.mocked(UserModel.create).mockResolvedValue({ _id: "u1", email: "a@b.com" } as any);
      vi.mocked(VerificationModel.create).mockResolvedValue({ _id: "v1", code: "CODE1" } as any);
      vi.mocked(sendEmail).mockResolvedValue({ data: null, error: new Error("send failed") } as any);

      await expect(
        authService.register({ name: "A", email: "a@b.com", password: "password123", confirmPassword: "password123" }),
      ).rejects.toThrow(/failed to send/i);

      expect(VerificationModel.findByIdAndDelete).toHaveBeenCalledWith("v1");
      expect(UserModel.findByIdAndDelete).toHaveBeenCalledWith("u1");
    });
  });

  describe("login", () => {
    it("rejects when no user exists for the email", async () => {
      vi.mocked(UserModel.findOne).mockResolvedValue(null);

      await expect(
        authService.login({ email: "nobody@example.com", password: "whatever123", userAgent: undefined }),
      ).rejects.toThrow(/invalid email or password/i);
    });

    it("rejects without checking the password when the account is locked", async () => {
      const user = makeFakeUser({ lockUntil: new Date(Date.now() + 60_000) });
      vi.mocked(UserModel.findOne).mockResolvedValue(user as any);

      await expect(
        authService.login({ email: user.email, password: "whatever123", userAgent: undefined }),
      ).rejects.toThrow(/temporarily locked/i);

      expect(user.comparePassword).not.toHaveBeenCalled();
    });

    it("registers a failed attempt and rejects on a wrong password", async () => {
      const user = makeFakeUser({ comparePassword: vi.fn().mockResolvedValue(false) });
      vi.mocked(UserModel.findOne).mockResolvedValue(user as any);

      await expect(
        authService.login({ email: user.email, password: "wrong-password", userAgent: undefined }),
      ).rejects.toThrow(/invalid email or password/i);

      expect(user.failedLoginAttempts).toBe(1);
    });

    it("returns mfaRequired without creating a session when MFA is enabled", async () => {
      const user = makeFakeUser({ userPreferences: { enable2FA: true } });
      vi.mocked(UserModel.findOne).mockResolvedValue(user as any);

      const result = await authService.login({ email: user.email, password: "correct123", userAgent: undefined });

      expect(result).toEqual({ user: null, mfaRequired: true, accessToken: "", refreshToken: "" });
      expect(SessionModel.create).not.toHaveBeenCalled();
    });

    it("resets the failure counter and creates a session on success", async () => {
      const user = makeFakeUser({ failedLoginAttempts: 3 });
      vi.mocked(UserModel.findOne).mockResolvedValue(user as any);
      vi.mocked(SessionModel.create).mockResolvedValue({ _id: "session1", refreshTokenVersion: 0 } as any);

      const result = await authService.login({ email: user.email, password: "correct123", userAgent: "jest" });

      expect(user.failedLoginAttempts).toBe(0);
      expect(result.mfaRequired).toBe(false);
      expect(typeof result.accessToken).toBe("string");
      expect(result.accessToken.length).toBeGreaterThan(0);
      expect(typeof result.refreshToken).toBe("string");
    });
  });

  describe("refreshToken", () => {
    const signRefresh = (sessionId: string, version: number) =>
      signJwtToken({ sessionId: sessionId as any, version }, refreshTokenSignOptions);

    it("rejects an invalid/garbage token", async () => {
      await expect(authService.refreshToken("not-a-real-token")).rejects.toThrow(/invalid refresh token/i);
    });

    it("rejects when the session no longer exists", async () => {
      vi.mocked(SessionModel.findById).mockResolvedValue(null);

      await expect(authService.refreshToken(signRefresh("s1", 0))).rejects.toThrow(/session does not exist/i);
    });

    it("rejects when the session has expired", async () => {
      vi.mocked(SessionModel.findById).mockResolvedValue({
        _id: "s1",
        expiresAt: new Date(Date.now() - 1000),
        refreshTokenVersion: 0,
      } as any);

      await expect(authService.refreshToken(signRefresh("s1", 0))).rejects.toThrow(/session expired/i);
    });

    it("deletes the session and rejects when the token version has been superseded", async () => {
      vi.mocked(SessionModel.findById).mockResolvedValue({
        _id: "s1",
        expiresAt: new Date(Date.now() + ONE_DAY_IN_MS * 10),
        refreshTokenVersion: 5,
      } as any);

      await expect(authService.refreshToken(signRefresh("s1", 0))).rejects.toThrow(/reuse detected/i);

      expect(SessionModel.findByIdAndDelete).toHaveBeenCalledWith("s1");
    });

    it("rotates the refresh token and bumps the version when close to expiry", async () => {
      const session = {
        _id: "s1",
        userId: "user123",
        expiresAt: new Date(Date.now() + ONE_DAY_IN_MS / 2),
        refreshTokenVersion: 0,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(SessionModel.findById).mockResolvedValue(session as any);

      const result = await authService.refreshToken(signRefresh("s1", 0));

      expect(session.refreshTokenVersion).toBe(1);
      expect(session.save).toHaveBeenCalledOnce();
      expect(result.newRefreshToken).toBeDefined();
    });

    it("does not rotate when the session is nowhere near expiry", async () => {
      const session = {
        _id: "s1",
        userId: "user123",
        expiresAt: new Date(Date.now() + ONE_DAY_IN_MS * 20),
        refreshTokenVersion: 0,
        save: vi.fn().mockResolvedValue(undefined),
      };
      vi.mocked(SessionModel.findById).mockResolvedValue(session as any);

      const result = await authService.refreshToken(signRefresh("s1", 0));

      expect(session.save).not.toHaveBeenCalled();
      expect(result.newRefreshToken).toBeUndefined();
    });
  });

  describe("verifyEmail", () => {
    it("verifies the user when the code is valid", async () => {
      vi.mocked(VerificationModel.findOneAndDelete).mockResolvedValue({ userId: "u1" } as any);
      vi.mocked(UserModel.findByIdAndUpdate).mockResolvedValue({ _id: "u1", isEmailVerified: true } as any);

      const result = await authService.verifyEmail("CODE1");

      expect(result.user.isEmailVerified).toBe(true);
    });

    it("rejects an invalid or expired code", async () => {
      vi.mocked(VerificationModel.findOneAndDelete).mockResolvedValue(null);

      await expect(authService.verifyEmail("BADCODE")).rejects.toThrow(/invalid or expired/i);
    });
  });

  describe("forgotPassword", () => {
    it("silently returns when no user exists for the email", async () => {
      vi.mocked(UserModel.findOne).mockResolvedValue(null);

      const result = await authService.forgotPassword("nobody@example.com");

      expect(result).toBeUndefined();
      expect(sendEmail).not.toHaveBeenCalled();
    });

    it("rejects once the reset-request rate limit is hit", async () => {
      vi.mocked(UserModel.findOne).mockResolvedValue({ _id: "u1", email: "a@b.com" } as any);
      vi.mocked(VerificationModel.countDocuments).mockResolvedValue(2);

      await expect(authService.forgotPassword("a@b.com")).rejects.toThrow(/too many request/i);
    });

    it("sends a reset email when under the rate limit", async () => {
      vi.mocked(UserModel.findOne).mockResolvedValue({ _id: "u1", email: "a@b.com" } as any);
      vi.mocked(VerificationModel.countDocuments).mockResolvedValue(0);
      vi.mocked(VerificationModel.create).mockResolvedValue({ _id: "v1", code: "CODE1" } as any);
      vi.mocked(sendEmail).mockResolvedValue({ data: { id: "email1" }, error: null } as any);

      const result = await authService.forgotPassword("a@b.com");

      expect(result?.url).toContain("CODE1");
    });

    it("rolls back the verification code when the email fails to send", async () => {
      vi.mocked(UserModel.findOne).mockResolvedValue({ _id: "u1", email: "a@b.com" } as any);
      vi.mocked(VerificationModel.countDocuments).mockResolvedValue(0);
      vi.mocked(VerificationModel.create).mockResolvedValue({ _id: "v1", code: "CODE1" } as any);
      vi.mocked(sendEmail).mockResolvedValue({ data: null, error: new Error("failed") } as any);

      await expect(authService.forgotPassword("a@b.com")).rejects.toThrow(/failed to send/i);

      expect(VerificationModel.findByIdAndDelete).toHaveBeenCalledWith("v1");
    });
  });

  describe("resetPassword", () => {
    it("resets the password and revokes every session for the user", async () => {
      vi.mocked(VerificationModel.findOneAndDelete).mockResolvedValue({ userId: "u1" } as any);
      vi.mocked(UserModel.findByIdAndUpdate).mockResolvedValue({ _id: "u1" } as any);
      vi.mocked(SessionModel.deleteMany).mockResolvedValue({} as any);

      const result = await authService.resetPassword({ password: "newpassword123", verificationCode: "CODE1" });

      expect(result.user._id).toBe("u1");
      expect(SessionModel.deleteMany).toHaveBeenCalledWith({ userId: "u1" });
    });

    it("rejects an invalid or expired code", async () => {
      vi.mocked(VerificationModel.findOneAndDelete).mockResolvedValue(null);

      await expect(
        authService.resetPassword({ password: "newpassword123", verificationCode: "BADCODE" }),
      ).rejects.toThrow(/invalid or expired/i);
    });
  });

  describe("logout", () => {
    it("deletes the session for the given user", async () => {
      vi.mocked(SessionModel.findOneAndDelete).mockResolvedValue({ _id: "s1" } as any);

      const result = await authService.logout("u1", "s1");

      expect(result.message).toMatch(/logged out/i);
    });

    it("rejects when the session does not belong to the user", async () => {
      vi.mocked(SessionModel.findOneAndDelete).mockResolvedValue(null);

      await expect(authService.logout("u1", "not-mine")).rejects.toThrow(/session not found/i);
    });
  });
});
