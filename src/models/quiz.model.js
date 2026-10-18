
import mongoose from "mongoose";
const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    subject:{
        type:String,
        required:true
    },
    quizes: [{
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
        }
    }]
}, {
    timestamps: true
}
)
export const Quiz=mongoose.model("Quiz",quizSchema)