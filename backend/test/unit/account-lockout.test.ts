import { describe, it, expect, vi } from "vitest";
import {
  assertAccountNotLocked,
  registerFailedAttempt,
  resetFailedAttempts,
} from "../../src/common/utils/account-lockout.js";
import type { UserDocument } from "../../src/database/models/user.model.js";

const makeFakeUser = (overrides: Partial<UserDocument> = {}) => {
  return {
    failedLoginAttempts: 0,
    lockUntil: undefined,
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as UserDocument;
};

describe("assertAccountNotLocked", () => {
  it("does not throw when the account has no lock", () => {
    const user = makeFakeUser();
    expect(() => assertAccountNotLocked(user)).not.toThrow();
  });

  it("throws when lockUntil is in the future", () => {
    const user = makeFakeUser({ lockUntil: new Date(Date.now() + 60_000) });
    expect(() => assertAccountNotLocked(user)).toThrow(/temporarily locked/i);
  });

  it("does not throw when lockUntil is in the past", () => {
    const user = makeFakeUser({ lockUntil: new Date(Date.now() - 60_000) });
    expect(() => assertAccountNotLocked(user)).not.toThrow();
  });
});

describe("registerFailedAttempt", () => {
  it("increments the counter without locking below the threshold", async () => {
    const user = makeFakeUser({ failedLoginAttempts: 3 });

    await registerFailedAttempt(user);

    expect(user.failedLoginAttempts).toBe(4);
    expect(user.lockUntil).toBeUndefined();
    expect(user.save).toHaveBeenCalledOnce();
  });

  it("locks the account and resets the counter on the 5th failure", async () => {
    const user = makeFakeUser({ failedLoginAttempts: 4 });

    await registerFailedAttempt(user);

    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockUntil).toBeInstanceOf(Date);
    expect(user.lockUntil!.getTime()).toBeGreaterThan(Date.now());
  });
});

describe("resetFailedAttempts", () => {
  it("clears the counter and lock", async () => {
    const user = makeFakeUser({
      failedLoginAttempts: 3,
      lockUntil: new Date(Date.now() + 60_000),
    });

    await resetFailedAttempts(user);

    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockUntil).toBeUndefined();
    expect(user.save).toHaveBeenCalledOnce();
  });

  it("skips saving when there is nothing to reset", async () => {
    const user = makeFakeUser();

    await resetFailedAttempts(user);

    expect(user.save).not.toHaveBeenCalled();
  });
});
