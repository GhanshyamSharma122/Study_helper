import { Router } from "express";
import {upload} from "../middlewares/multer.middleware.js"
import { addNewQuestionsOnTheQuiz,
     addQuizByJson,
     addQuizesManually,
     createNewQuizByPdf,
     createNewQuizByText,
     deleteQuiz,
     getAllQuizes, 
     getQuizById} from "../controllers/quiz.controller.js";
const router=Router()
router.get("/",getAllQuizes)
router.post("/text",createNewQuizByText)
router.post("/pdf",upload.single("pdf_file"),createNewQuizByPdf)
router.put("/:quizId",addNewQuestionsOnTheQuiz)
router.delete("/:quizId",deleteQuiz)
router.get("/:quizId",getQuizById)
router.post("/add-quiz",addQuizesManually)   
router.post("/json",addQuizByJson)
export default router