import express from "express";
import { chatController } from "../controllers/chatController.js";
import { chatRateLimiter } from "../config/rateLimiter.js";
import { networkTest } from "../utils/networkTest.js";
import { requireAuth, requireCurrentPolicies, requireVerifiedEmail } from "../middleware/auth.js";
import { asyncHandler, validateObjectIdBody, validateObjectIdParam } from "../utils/asyncHandler.js";

const router = express.Router();
router.post("/chat", requireAuth, requireVerifiedEmail, requireCurrentPolicies, chatRateLimiter, asyncHandler(chatController.handleChat));
router.post("/reset-context", requireAuth, requireVerifiedEmail, requireCurrentPolicies, validateObjectIdBody("conversationId"), asyncHandler(chatController.resetContext));
router.get("/context/:conversationId", requireAuth, validateObjectIdParam("conversationId"), asyncHandler(chatController.getContext));
router.get("/quality-analytics", requireAuth, asyncHandler(chatController.getQualityAnalytics));
if (process.env.NODE_ENV !== "production") {
  router.get("/network-test", asyncHandler(async (req, res) => {
    const results = await networkTest.testAllAPIs();
    res.json({ timestamp: new Date().toISOString(), connectivity: results });
  }));
}
export default router;
