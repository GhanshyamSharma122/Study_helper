import { Router } from "express";
import { upload, imageUpload } from "../middlewares/multer.middleware.js";
import {
  getAllSets,
  getById,
  createManual,
  createByText,
  createByPdf,
  updateSet,
  deleteSet,
  addQuestions,
  scoreAnswer,
  extractAnswer,
  getAttempts,
} from "../controllers/qna.controller.js";

const router = Router();

router.get("/", getAllSets);
router.post("/manual", createManual);
router.post("/text", createByText);
router.post("/pdf", upload.single("pdf_file"), createByPdf);
router.get("/:id", getById);
router.put("/:id", updateSet);
router.delete("/:id", deleteSet);
router.post("/:id/questions", addQuestions);
router.post("/:id/ocr", imageUpload.single("answer_image"), extractAnswer);
router.post("/:id/score", scoreAnswer);
router.get("/:id/attempts", getAttempts);

export default router;
