import mongoose, { type Document, Schema } from "mongoose";
import type { VerificationEnum } from "../../common/enums/verification.enum.js";
import { generatedUniqueCode } from "../../common/utils/uuid.js";

export interface VerificationCodeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  type: VerificationEnum;
  expiresAt: Date;
  createdAt: Date;
  status: "pending" | "failed";
}

const verificationCodeSchema = new Schema<VerificationCodeDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      default: generatedUniqueCode,
    },
    type: {
      type: String,
      required: true,
    },
    expiresAt: { type: Date, required: true, expires: 0 },
    createdAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "failed"],
      default: "pending",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

export const VerificationModel = mongoose.model<VerificationCodeDocument>(
  "Verification",
  verificationCodeSchema,
  "verificationcodes",
);

export default VerificationModel;
