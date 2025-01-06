import express from "express";
import { validateAddSingleAssessmentDetails, validateIncomingBulkTest, validateIncomingBulkUsers, validateUser } from "../../validations/AdminRouteValidations.js";
import { addBulkTestDataofUsers, addRemark, addSingleAssessmentDetails, addUser, allUsers, bulkUsersFromFile, getAllBatches, getAllModules, getAllTrainees, getAssessmentDetails, getAssessmentsDetailsForSpecificBatch, getAssessmentsForSpecificBatch, getBatch, getLocations, getTraineeDetails, getUserDetails, setBatchInactive, setUserInactive } from "../controllers/AdminController.js";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";

const adminRouterV2 = express.Router();

adminRouterV2.use(authMiddleware);
adminRouterV2.use(adminAuthMiddleware);
adminRouterV2.post('/bulk/users', upload.single('file'), validateIncomingBulkUsers, bulkUsersFromFile);
adminRouterV2.put('/users/toggle-active', setUserInactive);
adminRouterV2.put('/batch/toggle-active', setBatchInactive);
adminRouterV2.put('/users/user/remark', addRemark);
adminRouterV2.get('/trainees/info/:batchId', getAllTrainees);
adminRouterV2.post('/bulk/test', upload.single('file'), validateIncomingBulkTest, addBulkTestDataofUsers);
adminRouterV2.get("/trainees/:location?/:batchId?", allUsers);

/**
 * For trainee to get all details of trainee like exams and remarks
 */
adminRouterV2.get("/trainee/:employeeId", getTraineeDetails);

/**
 * For user:(Admin, Trainee and other if applicable) management 
 */
adminRouterV2.get("/user/:employeeId", getUserDetails);
adminRouterV2.get("/batches/:location?", getAllBatches);
adminRouterV2.get("/batch/:batchId", getBatch);
adminRouterV2.get("/modules", getAllModules);
adminRouterV2.post("/single/users", validateUser, addUser);
adminRouterV2.post("/single/assessment", validateAddSingleAssessmentDetails, addSingleAssessmentDetails);
adminRouterV2.get("/assessments/assessment/:assessmentId", getAssessmentDetails); //Exam.jsx
adminRouterV2.get("/assessments/:batchId/:assessmentType", getAssessmentsForSpecificBatch); // TraineeExamData
adminRouterV2.get("/assessments/:batchId", getAssessmentsDetailsForSpecificBatch); //Exams.jsx
adminRouterV2.get("/locations", getLocations);

export default adminRouterV2;