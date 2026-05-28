import express from "express";
import { authController } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();
router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/me", requireAuth, authController.me);
export default router;
