import express from "express";
import { addBulkTestDataofUsers, addSingleAssessmentDetails, addUser, allUsers, bulkUsersFromFile, getAllBatches, getAllModules, getAllTrainees, getAssessmentsDetailsForSpecificBatch, getAssessmentsForSpecificBatch, getBatch } from "../controllers/AdminController.js";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";
import { validateAddSingleAssessmentDetails, validateIncomingBulkTest, validateIncomingBulkUsers, validateUser } from "../validations/AdminRouteValidations.js";

const adminRouter = express.Router();

adminRouter.use(authMiddleware);
adminRouter.use(adminAuthMiddleware)
adminRouter.post('/bulk/users', upload.single('file'), validateIncomingBulkUsers, bulkUsersFromFile);
adminRouter.get('/trainees/info/:batchId', getAllTrainees)
adminRouter.post('/bulk/test', upload.single('file'), validateIncomingBulkTest, addBulkTestDataofUsers);
adminRouter.get("/trainees/:location?/:batchName?", allUsers);
adminRouter.get("/batches", getAllBatches);
adminRouter.get("/batch/:batchId", getBatch);
adminRouter.get("/modules", getAllModules);
adminRouter.post("/single/users", validateUser, addUser);
adminRouter.post("/single/assessment", validateAddSingleAssessmentDetails, addSingleAssessmentDetails);
adminRouter.get("/assessments/:batchId/:assessmentType", getAssessmentsForSpecificBatch);
adminRouter.get("/assessments/:batchId", getAssessmentsDetailsForSpecificBatch);
adminRouter.post("/single/test");
// adminRouter.get("/trainees/dd", get);

export default adminRouter;