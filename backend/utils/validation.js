import { z } from "zod";

const objectIdLike = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{24}$/, "Invalid identifier")
  .optional()
  .nullable()
  .transform((value) => value || null);

export const cleanText = (value = "", max = 3000) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const chatRequestSchema = z.object({
  clientRequestId: z.string({ required_error: "Client request ID is required" }).uuid("Invalid client request ID"),
  message: z
    .string({ required_error: "Message is required" })
    .transform((value) => cleanText(value, 3000))
    .refine((value) => value.length > 0, "Message is required")
    .refine((value) => value.length <= 3000, "Message is too long"),
  conversationId: objectIdLike,
  documentIds: z
    .array(z.string().trim().regex(/^[a-fA-F0-9]{24}$/, "Invalid document identifier"))
    .max(5, "Attach at most 5 documents to one request")
    .optional()
    .default([]),
});

export const authSignupSchema = z.object({
  name: z
    .string({ required_error: "Name is required" })
    .transform((value) => cleanText(value, 80))
    .refine((value) => value.length >= 2, "Name must be at least 2 characters"),
  email: z
    .string({ required_error: "Email is required" })
    .transform((value) => cleanText(value, 160).toLowerCase())
    .pipe(z.string().email("Enter a valid email address")),
  password: z
    .string({ required_error: "Password is required" })
    .min(10, "Password must be at least 10 characters")
    .max(128, "Password is too long")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Accept the privacy policy and terms to create an account" }) }),
});

export const authLoginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .transform((value) => cleanText(value, 160).toLowerCase())
    .pipe(z.string().email("Enter a valid email address")),
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const titleSchema = z
  .string()
  .transform((value) => cleanText(value, 80))
  .optional();

export const objectIdParamSchema = z.object({
  id: z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid identifier"),
});

export const validate = (schema, payload) => {
  const result = schema.safeParse(payload);
  if (result.success) return { data: result.data, error: null };
  return {
    data: null,
    error: result.error.errors?.[0]?.message || "Invalid request",
  };
};


export const preferencesSchema = z.object({
  homeAirport: z.string().transform((v) => cleanText(v, 80)).optional().default(""),
  preferredLanguage: z.string().transform((v) => cleanText(v, 40)).optional().default("English"),
  travelStyle: z.string().transform((v) => cleanText(v, 80)).optional().default("balanced"),
  budgetLevel: z.enum(["budget", "mid-range", "premium", "luxury", "balanced"]).optional().default("balanced"),
  dietaryNeeds: z.string().transform((v) => cleanText(v, 160)).optional().default(""),
  interests: z.array(z.string().transform((v) => cleanText(v, 40))).max(12).optional().default([]),
  accessibilityNeeds: z.string().transform((v) => cleanText(v, 160)).optional().default(""),
  familyMode: z.boolean().optional().default(false),
});

export const savedDestinationSchema = z.object({
  name: z.string({ required_error: "Destination name is required" }).transform((v) => cleanText(v, 120)).refine((v) => v.length >= 2, "Destination name is required"),
  country: z.string().transform((v) => cleanText(v, 80)).optional().default(""),
  notes: z.string().transform((v) => cleanText(v, 600)).optional().default(""),
  tags: z.array(z.string().transform((v) => cleanText(v, 40))).max(12).optional().default([]),
  lastKnownContext: z.record(z.any()).optional().default({}),
});

const itineraryItemSchema = z.object({
  time: z.string().transform((v) => cleanText(v, 40)).optional().default(""),
  title: z.string().transform((v) => cleanText(v, 160)).optional().default(""),
  note: z.string().transform((v) => cleanText(v, 500)).optional().default(""),
  costEstimate: z.coerce.number().min(0).max(100000).optional().default(0),
});

const itineraryDaySchema = z.object({
  day: z.coerce.number().int().min(1).max(60),
  title: z.string().transform((v) => cleanText(v, 120)).optional().default(""),
  location: z.string().transform((v) => cleanText(v, 120)).optional().default(""),
  items: z.array(itineraryItemSchema).max(20).optional().default([]),
});

export const itinerarySchema = z.object({
  title: z.string({ required_error: "Title is required" }).transform((v) => cleanText(v, 160)).refine((v) => v.length >= 2, "Title is required"),
  destination: z.string({ required_error: "Destination is required" }).transform((v) => cleanText(v, 160)).refine((v) => v.length >= 2, "Destination is required"),
  startDate: z.string().transform((v) => cleanText(v, 40)).optional().default(""),
  endDate: z.string().transform((v) => cleanText(v, 40)).optional().default(""),
  currency: z.string().transform((v) => cleanText(v, 12).toUpperCase()).optional().default("EUR"),
  budgetEstimate: z.object({
    accommodation: z.coerce.number().min(0).max(1000000).optional().default(0),
    food: z.coerce.number().min(0).max(1000000).optional().default(0),
    transport: z.coerce.number().min(0).max(1000000).optional().default(0),
    activities: z.coerce.number().min(0).max(1000000).optional().default(0),
    total: z.coerce.number().min(0).max(1000000).optional().default(0),
    note: z.string().transform((v) => cleanText(v, 500)).optional().default(""),
  }).optional(),
  days: z.array(itineraryDaySchema).max(60).optional().default([]),
});


export const emailOnlySchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .transform((value) => cleanText(value, 160).toLowerCase())
    .pipe(z.string().email("Enter a valid email address")),
});

export const tokenSchema = z.object({
  token: z.string({ required_error: "Token is required" }).transform((value) => cleanText(value, 256)).refine((value) => value.length >= 32, "Invalid token"),
});

export const resetPasswordSchema = z.object({
  token: z.string({ required_error: "Token is required" }).transform((value) => cleanText(value, 256)).refine((value) => value.length >= 32, "Invalid token"),
  password: z
    .string({ required_error: "Password is required" })
    .min(10, "Password must be at least 10 characters")
    .max(128, "Password is too long")
    .regex(/[A-Za-z]/, "Password must include a letter")
    .regex(/[0-9]/, "Password must include a number"),
});

export const accountDeleteSchema = z.object({
  password: z.string({ required_error: "Password is required" }).min(1, "Password is required"),
});

export const retentionSettingsSchema = z.object({
  dataRetentionDays: z.coerce.number().int().min(30).max(730),
});

export const policyAcceptanceSchema = z.object({
  privacyAccepted: z.literal(true, { errorMap: () => ({ message: "Policy acceptance is required" }) }),
});
