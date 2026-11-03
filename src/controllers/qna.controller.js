import { asyncHandler } from "../utils/asyncHandler.js";
import Joi from "joi";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { QnASet } from "../models/qna.model.js";
import { QnAAttempt } from "../models/qnaAttempt.model.js";
import { make_qna } from "../utils/qna_generator.js";
import { score_answer } from "../utils/qna_scorer.js";
import { extractTextFromPdf } from "../utils/extract_Text_pdf.js";
import { extractTextFromImage } from "../utils/extract_text_image.js";

const getUserId = (req) => {
  const userId = req.header("x-user-id");
  if (!userId) throw new ApiError(400, "Missing x-user-id header");
  return userId;
};

const questionSchema = Joi.object({
  question: Joi.string().required(),
  answer: Joi.string().required(),
  keywords: Joi.array().items(Joi.string()).optional(),
});

const getAllSets = asyncHandler(async (req, res) => {
  const sets = await QnASet.find().select("title subject questions createdAt updatedAt").sort({ createdAt: -1 });
  return res.status(200).json(new ApiResponse(200, sets, "qna sets fetched"));
});

const getById = asyncHandler(async (req, res) => {
  const set = await QnASet.findById(req.params.id);
  if (!set) throw new ApiError(404, "qna set not found");
  return res.status(200).json(new ApiResponse(200, set, "qna set fetched"));
});

const createManual = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().required(),
    subject: Joi.string().required(),
    questions: Joi.array().items(questionSchema).min(1).required(),
  });
  const { error } = schema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const { title, subject, questions } = req.body;
  const created = await QnASet.create({ title, subject, text: "", questions });
  return res.status(200).json(new ApiResponse(200, created, "qna set created"));
});

const createByText = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().required(),
    subject: Joi.string().required(),
    text: Joi.string().required(),
    numberOfQuestions: Joi.number().integer().min(1).max(100).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const { title, subject, text } = req.body;
  const numberOfQuestions = req.body.numberOfQuestions ?? 10;
  const questions = await make_qna(text, { count: numberOfQuestions });
  const created = await QnASet.create({ title, subject, text, questions });
  return res.status(200).json(new ApiResponse(200, created, "qna set created"));
});

const createByPdf = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().required(),
    subject: Joi.string().required(),
    numberOfQuestions: Joi.number().integer().min(1).max(100).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const { title, subject } = req.body;
  const numberOfQuestions = req.body.numberOfQuestions ?? 10;
  const filePath = req.file?.path;
  const text = await extractTextFromPdf(filePath);
  const questions = await make_qna(text, { count: numberOfQuestions });
  const created = await QnASet.create({ title, subject, text, questions });
  return res.status(200).json(new ApiResponse(200, created, "qna set created"));
});

const updateSet = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    title: Joi.string().optional(),
    subject: Joi.string().optional(),
    questions: Joi.array().items(questionSchema).optional(),
  });
  const { error } = schema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const set = await QnASet.findById(req.params.id);
  if (!set) throw new ApiError(404, "qna set not found");

  if (req.body.title !== undefined) set.title = req.body.title;
  if (req.body.subject !== undefined) set.subject = req.body.subject;
  if (req.body.questions !== undefined) set.questions = req.body.questions;

  await set.save();
  return res.status(200).json(new ApiResponse(200, set, "qna set updated"));
});

const deleteSet = asyncHandler(async (req, res) => {
  const deleted = await QnASet.findByIdAndDelete(req.params.id);
  if (!deleted) throw new ApiError(404, "qna set not found");
  await QnAAttempt.deleteMany({ setId: req.params.id });
  return res.status(200).json(new ApiResponse(200, {}, "deleted successfully"));
});

const addQuestions = asyncHandler(async (req, res) => {
  const set = await QnASet.findById(req.params.id);
  if (!set) throw new ApiError(404, "qna set not found");

  // Manual add
  if (Array.isArray(req.body?.questions)) {
    const schema = Joi.array().items(questionSchema).min(1);
    const { error } = schema.validate(req.body.questions);
    if (error) throw new ApiError(400, error.details[0].message);
    set.questions.push(...req.body.questions);
    await set.save();
    return res.status(200).json(new ApiResponse(200, set, "questions added"));
  }

  // AI generate more
  const numberOfQuestions = Number(req.body?.numberOfQuestions) || 5;
  if (!set.text) throw new ApiError(400, "no source text available to generate more");
  const more = await make_qna(
    set.text + "\n please make slightly harder questions this time",
    { count: numberOfQuestions }
  );
  set.questions.push(...more);
  await set.save();
  return res.status(200).json(new ApiResponse(200, set, "questions generated"));
});

const scoreAnswer = asyncHandler(async (req, res) => {
  const schema = Joi.object({
    questionIndex: Joi.number().integer().min(0).required(),
    userAnswer: Joi.string().allow("").required(),
  });
  const { error } = schema.validate(req.body);
  if (error) throw new ApiError(400, error.details[0].message);

  const set = await QnASet.findById(req.params.id);
  if (!set) throw new ApiError(404, "qna set not found");

  const idx = req.body.questionIndex;
  const q = set.questions[idx];
  if (!q) throw new ApiError(400, "invalid questionIndex");

  const userAnswer = String(req.body.userAnswer || "").trim();
  if (!userAnswer) {
    return res
      .status(200)
      .json(new ApiResponse(200, { score: 0, missing: [], feedback: "No answer provided." }, "scored"));
  }

  const result = await score_answer({
    question: q.question,
    referenceAnswer: q.answer,
    userAnswer,
    keywords: q.keywords,
  });

  // Store attempt (best-effort; requires userId but don't fail scoring if missing)
  try {
    const userId = req.header("x-user-id");
    if (userId) {
      await QnAAttempt.create({
        userId,
        setId: set._id,
        questionIndex: idx,
        question: q.question,
        userAnswer,
        score: result.score,
        missing: result.missing,
        feedback: result.feedback,
      });
    }
  } catch (e) {
    // ignore attempt persistence errors
  }

  return res.status(200).json(new ApiResponse(200, result, "scored"));
});

const extractAnswer = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "An answer image is required");
  const set = await QnASet.findById(req.params.id);
  if (!set) throw new ApiError(404, "qna set not found");
  const questionIndex = Number(req.body.questionIndex);
  if (!Number.isInteger(questionIndex) || !set.questions[questionIndex]) {
    throw new ApiError(400, "invalid questionIndex");
  }

  try {
    const text = await extractTextFromImage(req.file.buffer);
    return res.status(200).json(new ApiResponse(200, { text }, "answer extracted"));
  } catch (error) {
    throw new ApiError(502, error.message || "Could not extract text from the image");
  }
});

const getAttempts = asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const attempts = await QnAAttempt.find({ userId, setId: req.params.id })
    .sort({ createdAt: -1 })
    .limit(200);
  return res.status(200).json(new ApiResponse(200, attempts, "attempts fetched"));
});

export {
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
};
