import mongoose from "mongoose";

const PreferencesSchema = new mongoose.Schema(
  {
    homeAirport: { type: String, trim: true, maxlength: 80, default: "" },
    preferredLanguage: { type: String, trim: true, maxlength: 40, default: "English" },
    travelStyle: { type: String, trim: true, maxlength: 80, default: "balanced" },
    budgetLevel: { type: String, enum: ["budget", "mid-range", "premium", "luxury", "balanced"], default: "balanced" },
    dietaryNeeds: { type: String, trim: true, maxlength: 160, default: "" },
    interests: [{ type: String, trim: true, maxlength: 40 }],
    accessibilityNeeds: { type: String, trim: true, maxlength: 160, default: "" },
    familyMode: { type: Boolean, default: false },
  },
  { _id: false },
);

const LegalAcceptanceSchema = new mongoose.Schema(
  {
    privacyVersion: { type: String, required: true },
    termsVersion: { type: String, required: true },
    acceptedAt: { type: Date, required: true },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    emailVerified: { type: Boolean, default: false, index: true },
    emailVerifiedAt: Date,
    emailVerificationTokenHash: { type: String, select: false, index: true },
    emailVerificationExpires: { type: Date, select: false },
    passwordResetTokenHash: { type: String, select: false, index: true },
    passwordResetExpires: { type: Date, select: false },
    preferences: { type: PreferencesSchema, default: () => ({}) },
    legalAcceptance: { type: LegalAcceptanceSchema, default: undefined },
    dataRetentionDays: { type: Number, min: 30, max: 730, default: 365 },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    tokenVersion: { type: Number, default: 0 },
    lastLoginAt: Date,
    deletionPending: { type: Boolean, default: false, index: true },
    deletionRequestedAt: Date,
    activeChatOperations: { type: Number, default: 0, min: 0, select: false },
    activeUploadOperations: { type: Number, default: 0, min: 0, select: false },
  },
  { timestamps: true },
);

UserSchema.index({ createdAt: -1 });
UserSchema.index({ passwordResetExpires: 1 }, { sparse: true });
UserSchema.index({ emailVerificationExpires: 1 }, { sparse: true });

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
