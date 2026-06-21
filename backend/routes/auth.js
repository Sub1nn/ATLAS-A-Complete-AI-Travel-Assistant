import express from "express";
import { authController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authRateLimiter, emailResendRateLimiter, passwordResetRateLimiter } from "../config/rateLimiter.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.post("/signup", authRateLimiter, asyncHandler(authController.signup));
router.post("/login", authRateLimiter, asyncHandler(authController.login));
router.get("/me", requireAuth, asyncHandler(authController.me));
router.post("/verify-email", authRateLimiter, asyncHandler(authController.verifyEmail));
router.post("/resend-verification", requireAuth, emailResendRateLimiter, asyncHandler(authController.resendVerification));
router.post("/forgot-password", passwordResetRateLimiter, asyncHandler(authController.forgotPassword));
router.post("/reset-password", passwordResetRateLimiter, asyncHandler(authController.resetPassword));
router.patch("/preferences", requireAuth, asyncHandler(authController.updatePreferences));
export default router;
