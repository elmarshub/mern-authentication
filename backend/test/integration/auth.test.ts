import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "../../src/app.js";
import UserModel from "../../src/database/models/user.model.js";

const EMAIL = "lockout-test@example.com";
const PASSWORD = "correct-password-123";

beforeEach(async () => {
  await UserModel.create({
    name: "Lockout Test",
    email: EMAIL,
    password: PASSWORD,
  });
});

describe("POST /api/v1/auth/login", () => {
  it("returns 200 and sets auth cookies on correct credentials", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(EMAIL);
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("returns 400 on a wrong password without revealing which field was wrong", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: EMAIL, password: "wrong-password" });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid email or password/i);
  });

  it("locks the account after 5 failed attempts, rejecting even the correct password on the 6th try", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: EMAIL, password: "wrong-password" });

      expect(res.status).toBe(400);
    }

    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(429);
    expect(res.body.message).toMatch(/temporarily locked/i);
  });
});

describe("PUT /api/v1/auth/password/change", () => {
  it("rejects without an access token cookie", async () => {
    const res = await request(app)
      .put("/api/v1/auth/password/change")
      .send({ currentPassword: PASSWORD, newPassword: "brand-new-password-1" });

    expect(res.status).toBe(401);
  });

  it("persists the new password so it authenticates and the old one no longer does", async () => {
    const agent = request.agent(app);
    await agent.post("/api/v1/auth/login").send({ email: EMAIL, password: PASSWORD });

    const changeRes = await agent
      .put("/api/v1/auth/password/change")
      .send({ currentPassword: PASSWORD, newPassword: "brand-new-password-1" });

    expect(changeRes.status).toBe(200);

    // Verified directly against the database rather than a second /login round trip,
    // since loginRateLimiter's in-memory counter is shared across every test in this file.
    const updatedUser = await UserModel.findOne({ email: EMAIL });
    expect(await updatedUser!.comparePassword("brand-new-password-1")).toBe(true);
    expect(await updatedUser!.comparePassword(PASSWORD)).toBe(false);
  });
});

describe("POST /api/v1/auth/verify/email/resend", () => {
  it("returns a neutral 200 for an email that doesn't belong to any account", async () => {
    const res = await request(app)
      .post("/api/v1/auth/verify/email/resend")
      .send({ email: "no-such-user@example.com" });

    expect(res.status).toBe(200);
  });

  it("returns the same neutral 200 for an already-verified account, without sending anything", async () => {
    await UserModel.findOneAndUpdate({ email: EMAIL }, { isEmailVerified: true });

    const res = await request(app)
      .post("/api/v1/auth/verify/email/resend")
      .send({ email: EMAIL });

    expect(res.status).toBe(200);
  });
});
