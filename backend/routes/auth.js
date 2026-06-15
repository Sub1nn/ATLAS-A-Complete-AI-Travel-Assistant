import express from "express";
import { authController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = express.Router();
router.post("/signup", asyncHandler(authController.signup));
router.post("/login", asyncHandler(authController.login));
router.get("/me", requireAuth, asyncHandler(authController.me));
router.get("/verify-email", asyncHandler(authController.verifyEmail));
router.post("/resend-verification", requireAuth, asyncHandler(authController.resendVerification));
router.post("/forgot-password", asyncHandler(authController.forgotPassword));
router.post("/reset-password", asyncHandler(authController.resetPassword));
router.patch("/preferences", requireAuth, asyncHandler(authController.updatePreferences));
export default router;
