import express from "express";
import { getAssessmentCountByType, getBatches, getExams, getOngoingTrainingOfUser, getQuizCount, getQuizPercentage, getRemarks, getTrainingInProgressCount, getTrainings } from "../controllers/TraineeController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { traineeAuthMiddleware } from "../middlewares/traineeAuthMiddleware.js";


const traineeRouterV2 = express.Router();
traineeRouterV2.use(authMiddleware);
traineeRouterV2.use(traineeAuthMiddleware);
traineeRouterV2.get("/exams/:batchId?", getExams);
traineeRouterV2.get("/remarks", getRemarks);
traineeRouterV2.get("/batches", getBatches);
traineeRouterV2.get("/quiz/count", getQuizCount);
traineeRouterV2.get("/quiz/percentage", getQuizPercentage);
traineeRouterV2.get("/trainings", getTrainings);
traineeRouterV2.get("/trainings/in-progress/count", getTrainingInProgressCount);
traineeRouterV2.get("/assessments/count/by/type", getAssessmentCountByType);
traineeRouterV2.get("/user/ongoing-training", getOngoingTrainingOfUser);

export default traineeRouterV2;