import express from "express";
import { getExams } from "../controllers/TraineeController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";


const traineeRouter = express.Router();
traineeRouter.use(authMiddleware);
traineeRouter.get("/exams", getExams);

export default traineeRouter;