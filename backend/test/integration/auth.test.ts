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
