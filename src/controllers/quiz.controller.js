import { asyncHandler } from "../utils/asyncHandler.js"
import Joi from "joi"
import { ApiResponse } from "../utils/ApiResponse.js"
import { ApiError } from "../utils/ApiError.js"
import { Quiz } from "../models/quiz.model.js"
import { make_mcqs } from "../utils/mcq_generator.js"
import { extractTextFromPdf } from "../utils/extract_Text_pdf.js"
import { YoutubeTranscript } from 'youtube-transcript';

const getMcqs = async (text, numberOfQuestions) => {
    return await make_mcqs(text, { count: numberOfQuestions });
}
const addQuizesManually = asyncHandler(async (req, res) => {
    const schema = Joi.object({
        title: Joi.string().required(),
        subject: Joi.string().required(),
        quizes: Joi.array().items(
            Joi.object({
                question: Joi.string().required(),
                option1: Joi.string().required(),
                option2: Joi.string().required(),
                option3: Joi.string().required(),
                option4: Joi.string().required(),
                correctOption: Joi.number().valid(1, 2, 3, 4).required(),
            })
        )
    })
    const { error } = schema.validate(req.body)
    if (error) {
        throw new ApiError(400, error.details[0].message)
    }
    const { title, subject, quizes } = req.body
    const createdQuiz = await Quiz.create({
        title,
        subject,
        text: JSON.stringify(quizes),
        quizes
    })
    return res
        .status(200)
        .json(
            new ApiResponse(200, createdQuiz, "all mcqs fetched successfully")
        )
})

const createNewQuizByPdf = asyncHandler(async (req, res) => {
    const schema = Joi.object({
        title: Joi.string().required(),
        subject: Joi.string().required(),
        numberOfQuestions: Joi.number().integer().min(1).max(500).optional(),
    })
    const { error } = schema.validate(req.body)
    if (error) {
        throw new ApiError(400, error.details[0].message)
    }
    const { title, subject } = req.body
    const numberOfQuestions = req.body.numberOfQuestions ?? 100
    const filePath = req.file?.path
    const text = await extractTextFromPdf(filePath)
    const mcqs = await getMcqs(text, numberOfQuestions)
    const createdQuiz = await Quiz.create({
        title,
        subject,
        text,
        quizes: mcqs
    })
    return res
        .status(200)
        .json(
            new ApiResponse(200, createdQuiz, "all mcqs fetched successfully")
        )

})
const createNewQuizByText = asyncHandler(async (req, res) => {
    const schema = Joi.object({
        title: Joi.string().required(),
        text: Joi.string().required(),
        subject: Joi.string().required(),
    })
    const { error } = schema.validate(req.body)
    if (error) {
        throw new ApiError(400, error.details[0].message)
    }
    const { title, subject, text } = req.body
    const mcqs = await getMcqs(text)
    const createdQuiz = await Quiz.create({
        title,
        subject,
        text,
        quizes: mcqs
    })
    return res
        .status(200)
        .json(
            new ApiResponse(200, createdQuiz, "all mcqs fetched successfully")
        )
})

const addNewQuestionsOnTheQuiz = asyncHandler(async (req, res) => {
    const quizId = req.params.quizId
    const getQuizInfo = await Quiz.findById(quizId).select("text")
    if (!getQuizInfo) {
        throw new ApiError(400, "the quiz doesnot exists")
    }
    let mcqs = await getMcqs(getQuizInfo.text + "\n please make a bit harder quiz this time")
    mcqs = await Quiz.findByIdAndUpdate(quizId, {
        $push: {
            quizes: {
                $each: mcqs
            }
        }
    }, { new: true })
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                mcqs,
                "new mcqs generated"
            )
        )
})
const addQuizByJson = asyncHandler(async (req, res) => {
    const schema = Joi.object(
        {
            title: Joi.string().required(),
            subject: Joi.string().required(),
            quizes: Joi.array().items(
                Joi.object({
                    question: Joi.string().required(),
                    option1: Joi.string().required(),
                    option2: Joi.string().required(),
                    option3: Joi.string().required(),
                    option4: Joi.string().required(),
                    correctOption: Joi.number().valid(1, 2, 3, 4).required()
                })
            )
        }
    )
    const { error } = schema.validate(req.body)
    if (error) {
        throw new ApiError(400, error.details[0].message)
    }
    const { title, subject, quizes } = req.body
    

    const createdQuiz = await Quiz.create({
        title, subject, quizes, text: JSON.stringify(quizes)
    })
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                createdQuiz,
                "quiz created successfully"
            )
        )
})
const getAllQuizes = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                await Quiz.find().select("title quizes subject"),
                "all quiz fetched successfully"
            )
        )
})

const getQuizById = asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(req.params.quizId)
    if (!quiz) {
        throw new ApiError(404, "quiz not found")
    }
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                quiz,
                "all quiz fetched successfully"
            )
        )
})

const deleteQuiz = asyncHandler(async (req, res) => {
    const quiz = await Quiz.findById(req.params.quizId)
    if (!quiz) {
        throw new ApiError(404, "quiz not found")
    }
    await Quiz.findByIdAndDelete(req.params.quizId)
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "deleted successfully"
            )
        )
})
export {
    createNewQuizByText,
    addNewQuestionsOnTheQuiz,
    getAllQuizes,
    getQuizById,
    createNewQuizByPdf,
    deleteQuiz,
    addQuizesManually,
    addQuizByJson,
    
}