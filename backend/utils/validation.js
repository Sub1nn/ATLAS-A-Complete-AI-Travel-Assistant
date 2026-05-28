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
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
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
