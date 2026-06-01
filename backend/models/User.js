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
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    preferences: { type: PreferencesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

export const User = mongoose.models.User || mongoose.model("User", UserSchema);
