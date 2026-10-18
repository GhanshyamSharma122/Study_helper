import express from "express"
import cors from "cors"

const app=express()
app.use(cors(
    {
        origin:process.env.CORS_ORIGIN,
        credential:true
    }
))
app.use(express.json({limit:'16mb'}))
app.use(express.urlencoded({extended:true,limit:"16mb"}))
app.use(express.static("public/dist"))
app.use("/practice", express.static("public/practice"))


//router import
import quizRouter from "./routes/quiz.route.js"
import mistakeRouter from "./routes/mistake.route.js"
//routes definition
app.use("/api/v1/quiz",quizRouter)
app.use("/api/v1/mistakes",mistakeRouter)

export {app}