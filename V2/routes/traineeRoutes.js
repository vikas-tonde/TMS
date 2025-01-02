import express from "express";
import { getExams } from "../controllers/TraineeController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";


const traineeRouterV2 = express.Router();
traineeRouterV2.use(authMiddleware);
traineeRouterV2.get("/exams", getExams);

export default traineeRouterV2;