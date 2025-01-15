import express from "express";
import { getBatches, getExams, getRemarks } from "../controllers/TraineeController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { traineeAuthMiddleware } from "../middlewares/traineeAuthMiddleware.js";


const traineeRouterV2 = express.Router();
traineeRouterV2.use(authMiddleware);
traineeRouterV2.use(traineeAuthMiddleware);
traineeRouterV2.get("/exams/:batchId?", getExams);
traineeRouterV2.get("/remarks", getRemarks);
traineeRouterV2.get("/batches", getBatches);

export default traineeRouterV2;