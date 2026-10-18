import { Router } from "express";
import {
    saveMistakes,
    getMistakes,
    resolveMistake,
    deleteMistake
} from "../controllers/mistake.controller.js"

const router = Router()

router.post("/", saveMistakes)
router.get("/", getMistakes)
router.post("/resolve", resolveMistake)
router.delete("/:id", deleteMistake)

export default router
