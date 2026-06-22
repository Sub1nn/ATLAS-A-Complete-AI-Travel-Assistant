import express from "express";
import { requireAuth, requireCurrentPolicies, requireVerifiedEmail } from "../middleware/auth.js";
import { documentController, upload } from "../controllers/documentController.js";
import { asyncHandler, validateObjectIdParam } from "../utils/asyncHandler.js";
import { documentUploadRateLimiter } from "../config/rateLimiter.js";

const router = express.Router();
router.use(requireAuth, requireVerifiedEmail, requireCurrentPolicies);
router.get("/", asyncHandler(documentController.list));
router.post("/upload", documentUploadRateLimiter, upload.single("file"), asyncHandler(documentController.upload));
router.post("/:id/retry", validateObjectIdParam("id"), asyncHandler(documentController.retry));
router.delete("/:id", validateObjectIdParam("id"), asyncHandler(documentController.remove));
export default router;
