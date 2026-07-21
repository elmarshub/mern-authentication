import mongoose, { type Document, Schema } from "mongoose";
import type { VerificationEnum } from "../../common/enums/verification.enum.js";
import { generatedUniqueCode } from "../../common/utils/uuid.js";

export interface VerificationCodeDocument extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  type: VerificationEnum;
  expiresAt: Date;
  createdAt: Date;
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
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  },
);

export const VerificationCodeModel = mongoose.model<VerificationCodeDocument>(
  "VerificationCode",
  verificationCodeSchema,
);

export default VerificationCodeModel;
