import express from "express";
import { conversationController } from "../controllers/conversationController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler, validateObjectIdParam } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(conversationController.list));
router.post("/", asyncHandler(conversationController.create));
router.get("/:id", validateObjectIdParam("id"), asyncHandler(conversationController.get));
router.delete("/", asyncHandler(conversationController.clearAll));
router.delete("/:id", validateObjectIdParam("id"), asyncHandler(conversationController.remove));
export default router;
