import mongoose, { Schema, Document } from "mongoose";
import { thirtyDaysFromNow } from "../../common/utils/date-time.js";

export interface SessionDocument extends Document {
  userId: mongoose.Types.ObjectId;
  userAgent?: string;
  expiresAt: Date;
  createdAt: Date;
}

const sessionSchema = new Schema<SessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userAgent: { type: String, required: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, default: thirtyDaysFromNow },
  },
  {
    timestamps: true,
  },
);

export const Session = mongoose.model<SessionDocument>(
  "Session",
  sessionSchema,
);

export default Session;
