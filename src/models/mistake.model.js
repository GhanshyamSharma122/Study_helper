import mongoose from "mongoose";

const mistakeSchema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            index: true
        },
        quizId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Quiz"
        },
        question: {
            type: String,
            required: true
        },
        option1: {
            type: String,
            required: true
        },
        option2: {
            type: String,
            required: true
        },
        option3: {
            type: String,
            required: true
        },
        option4: {
            type: String,
            required: true
        },
        correctOption: {
            type: Number,
            required: true,
            enum: [1, 2, 3, 4]
        },
        selectedOption: {
            type: Number,
            enum: [1, 2, 3, 4],
            default: null
        },
        wrongCount: {
            type: Number,
            default: 1
        },
        mastered: {
            type: Boolean,
            default: false
        },
        lastWrongAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// A question is only tracked once per user, regardless of which quiz it came from.
mistakeSchema.index({ userId: 1, question: 1 }, { unique: true });

export const Mistake = mongoose.model("Mistake", mistakeSchema);
