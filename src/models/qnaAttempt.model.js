import mongoose from "mongoose";

const qnaAttemptSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    setId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QnASet",
      required: true,
      index: true,
    },
    questionIndex: { type: Number, required: true },
    question: { type: String, required: true },
    userAnswer: { type: String, required: true },
    score: { type: Number, min: 0, max: 10, default: null },
    missing: { type: [String], default: [] },
    feedback: { type: String, default: "" },
  },
  { timestamps: true }
);

qnaAttemptSchema.index({ userId: 1, setId: 1, createdAt: -1 });

export const QnAAttempt = mongoose.model("QnAAttempt", qnaAttemptSchema);