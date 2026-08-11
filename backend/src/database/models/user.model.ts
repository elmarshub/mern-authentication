import mongoose, { Schema, type Document } from "mongoose";
import { hashValue, compareValue } from "../../common/utils/bcrypt.js";

interface UserPreference {
  enable2FA: boolean;
  emailNotifications: boolean;
  twoFactorSecret?: string | undefined;
  twoFactorRecoveryCodes?: string[] | undefined;
}

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  isEmailVerified: boolean;
  userPreferences: UserPreference;
  failedLoginAttempts: number;
  lockUntil?: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
  comparePassword: (value: string) => Promise<boolean>;
}

const userPreferencesSchema = new Schema<UserPreference>({
  enable2FA: { type: Boolean, default: false },
  emailNotifications: { type: Boolean, default: true },
  twoFactorSecret: { type: String, required: false },
  twoFactorRecoveryCodes: { type: [String], default: undefined },
});

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isEmailVerified: { type: Boolean, default: false },
    userPreferences: { type: userPreferencesSchema, default: {} },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, required: false },
  },
  {
    timestamps: true,
    toJSON: {},
  },
);

userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await hashValue(this.password);
  }
  next();
});

userSchema.methods.comparePassword = async function (value: string) {
  return await compareValue(value, this.password);
};

userSchema.set("toJSON", {
  transform: function (doc: Document, ret: Record<string, any>) {
    delete ret.password;
    delete ret.userPreferences.twoFactorSecret;
    delete ret.userPreferences.twoFactorRecoveryCodes;
    return ret;
  },
});

const UserModel = mongoose.model<UserDocument>("User", userSchema);

export default UserModel;
