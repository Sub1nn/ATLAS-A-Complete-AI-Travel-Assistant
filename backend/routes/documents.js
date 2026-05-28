import express from "express";
import { requireAuth } from "../middleware/auth.js";
import { documentController, upload } from "../controllers/documentController.js";

const router = express.Router();
router.use(requireAuth);
router.get("/", documentController.list);
router.post("/upload", upload.single("file"), documentController.upload);
router.delete("/:id", documentController.remove);
export default router;
