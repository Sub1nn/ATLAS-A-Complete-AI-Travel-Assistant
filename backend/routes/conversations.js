import express from "express";
import { conversationController } from "../controllers/conversationController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", conversationController.list);
router.post("/", conversationController.create);
router.get("/:id", conversationController.get);
router.delete("/", conversationController.clearAll);
router.delete("/:id", conversationController.remove);
export default router;
