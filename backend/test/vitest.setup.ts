import { beforeAll, afterAll, afterEach } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.APP_ORIGIN = "http://localhost:3000";
process.env.JWT_SECRET = "a".repeat(32);
process.env.JWT_REFRESH_SECRET = "b".repeat(32);
process.env.MAILER_SENDER = "test@example.com";
process.env.RESEND_API_KEY = "test-resend-key";
process.env.MONGO_URI = "mongodb://placeholder-overridden-below";

let mongoServer: MongoMemoryServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const name in collections) {
    await collections[name]!.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});
