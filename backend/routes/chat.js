import express from "express";
import { chatController } from "../controllers/chatController.js";
import { chatRateLimiter } from "../config/rateLimiter.js";
import { networkTest } from "../utils/networkTest.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.post("/chat", requireAuth, chatRateLimiter, chatController.handleChat);
router.post("/reset-context", requireAuth, chatController.resetContext);
router.get("/context/:userId", requireAuth, chatController.getContext);
router.get("/quality-analytics", requireAuth, chatController.getQualityAnalytics);
router.get("/network-test", async (req, res) => {
  try {
    const results = await networkTest.testAllAPIs();
    res.json({ timestamp: new Date().toISOString(), connectivity: results });
  } catch (error) {
    res.status(500).json({ error: "Network test failed", message: error.message });
  }
});
export default router;
