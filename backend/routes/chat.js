import express from "express";
import { chatController } from "../controllers/chatController.js";
import { chatRateLimiter } from "../config/rateLimiter.js";
import { networkTest } from "../utils/networkTest.js";

const router = express.Router();

// Chat endpoint with specific rate limiting
router.post("/chat", chatRateLimiter, chatController.handleChat);

// Context management endpoints
router.post("/reset-context", chatController.resetContext);
router.get("/context/:userId", chatController.getContext);
router.get("/quality-analytics", chatController.getQualityAnalytics);

// Network diagnostics endpoint
router.get("/network-test", async (req, res) => {
  try {
    const results = await networkTest.testAllAPIs();
    res.json({
      timestamp: new Date().toISOString(),
      connectivity: results,
      summary: {
        allWorking: Object.values(results).every((r) => r.success),
        workingAPIs: Object.entries(results)
          .filter(([_, r]) => r.success)
          .map(([name]) => name),
        failingAPIs: Object.entries(results)
          .filter(([_, r]) => !r.success)
          .map(([name]) => name),
      },
    });
  } catch (error) {
    res.status(500).json({
      error: "Network test failed",
      message: error.message,
    });
  }
});

export default router;
