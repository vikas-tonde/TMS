import express from "express";
import { getExams } from "../controllers/TraineeController";
import { authMiddleware } from "../middlewares/authMiddleware";


const traineeRouter = express.Router();
traineeRouter.use(authMiddleware);
traineeRouter.get("/exams", getExams);

export default traineeRouter;