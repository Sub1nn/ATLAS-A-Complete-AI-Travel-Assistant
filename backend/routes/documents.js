import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { documentController, upload } from "../controllers/documentController.js";
import { asyncHandler, validateObjectIdParam } from "../utils/asyncHandler.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", asyncHandler(documentController.list));
router.post("/upload", upload.single("file"), asyncHandler(documentController.upload));
router.delete("/:id", validateObjectIdParam("id"), asyncHandler(documentController.remove));
export default router;
