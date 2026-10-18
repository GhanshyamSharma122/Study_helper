import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js"
import { Mistake } from "../models/mistake.model.js"

const getUserId = (req) => {
    const userId = req.header("x-user-id")
    if (!userId) {
        throw new ApiError(400, "Missing x-user-id header")
    }
    return userId
}

/**
 * Save the questions the user got wrong after a quiz attempt.
 * Body: { quizId, questions: [{ question, option1..4, correctOption, selectedOption }] }
 */
const saveMistakes = asyncHandler(async (req, res) => {
    const userId = getUserId(req)
    const { quizId, questions } = req.body

    if (!Array.isArray(questions) || questions.length === 0) {
        throw new ApiError(400, "questions must be a non-empty array")
    }

    for (const q of questions) {
        if (!q.question || !q.correctOption) {
            throw new ApiError(400, "each question needs a question and correctOption")
        }

        await Mistake.findOneAndUpdate(
            { userId, question: q.question },
            {
                $set: {
                    quizId: quizId || null,
                    option1: q.option1,
                    option2: q.option2,
                    option3: q.option3,
                    option4: q.option4,
                    correctOption: q.correctOption,
                    selectedOption: q.selectedOption ?? null,
                    mastered: false,
                    lastWrongAt: new Date()
                },
                $inc: { wrongCount: 1 }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        )
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { saved: questions.length }, "mistakes saved"))
})

/**
 * Fetch the user's active (not yet mastered) mistakes for practice.
 */
const getMistakes = asyncHandler(async (req, res) => {
    const userId = getUserId(req)
    const mistakes = await Mistake.find({ userId, mastered: false })
        .select("-__v")
        .sort({ lastWrongAt: -1 })

    return res
        .status(200)
        .json(new ApiResponse(200, mistakes, "mistakes fetched"))
})

/**
 * Mark a mistake as mastered once the user answers it correctly.
 * Body: { mistakeId } or { question }
 */
const resolveMistake = asyncHandler(async (req, res) => {
    const userId = getUserId(req)
    const { mistakeId, question } = req.body

    const filter = mistakeId ? { _id: mistakeId, userId } : { userId, question }
    if (!filter._id && !filter.question) {
        throw new ApiError(400, "provide either mistakeId or question")
    }

    const updated = await Mistake.findOneAndUpdate(
        filter,
        { mastered: true },
        { new: true }
    )
    if (!updated) {
        throw new ApiError(404, "mistake not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "mistake mastered"))
})

/**
 * Remove a mistake from the practice list.
 */
const deleteMistake = asyncHandler(async (req, res) => {
    const userId = getUserId(req)
    const deleted = await Mistake.findOneAndDelete({ _id: req.params.id, userId })
    if (!deleted) {
        throw new ApiError(404, "mistake not found")
    }

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "mistake deleted"))
})

export { saveMistakes, getMistakes, resolveMistake, deleteMistake }
