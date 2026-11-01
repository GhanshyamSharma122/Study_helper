import mongoose from "mongoose";

const qnaQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    answer: { type: String, required: true },
    keywords: { type: [String], default: [] },
  },
  { _id: false }
);

const qnaSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subject: { type: String, required: true },
    text: { type: String, default: "" },
    questions: {
      type: [qnaQuestionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

qnaSchema.index({ createdAt: -1 });

export const QnASet = mongoose.model("QnASet", qnaSchema);