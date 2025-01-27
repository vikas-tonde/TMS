import express from "express";
import { validateAddSingleAssessmentDetails, validateAddTraining, validateExistingUserInBatch, validateIncomingBulkTest, validateIncomingBulkUsers, validateUser } from "../../validations/AdminRouteValidations.js";
import { addBatchForExistingUser, addBulkTestDataofUsers, addLocation, addModules, addRemark, addSingleAssessmentDetails, addTraining, addUser, allUsers, assignTraining, bulkUsersFromFile, deleteAssessment, deleteBatch, deleteLocation, deleteModules, deleteTraining, deleteUser, deleteUsers, getAllBatches, getAllBatchesIncludingInactive, getAllModules, getAllRoles, getAllTrainees, getAllTraineesByLocationsAndNotInBatch, getAllTrainings, getAssessmentDetails, getAssessmentScoresForTraineeByBatch, getAssessmentsDetailsForSpecificBatch, getAssessmentsForSpecificBatch, getBatch, getBatchesOfUser, getLocations, getTraineeDetails, getTrainingDetails, getTrainingsOfUser, getUserDetails, removeTrainingOfUser, removeUserFromBatch, resetPassword, setBatchInactive, toggleUserIsActive, updateTraining, updateUserDetails } from "../controllers/AdminController.js";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";

const adminRouterV2 = express.Router();

adminRouterV2.use(authMiddleware);
adminRouterV2.use(adminAuthMiddleware);

adminRouterV2.get('/roles', getAllRoles);
adminRouterV2.get('/trainees/info/:batchId', getAllTrainees);
adminRouterV2.get("/trainees/:location?/:batchId?", allUsers);

/**
 * For trainee to get all details of trainee like exams and remarks.
 */
adminRouterV2.get("/trainee/:employeeId", getTraineeDetails);

/**
 * For user:(Admin, Trainee and other if applicable) management.
 */
adminRouterV2.get("/user/:employeeId", getUserDetails);

/**
 * For fetching all batches including inactive batches.
 */
adminRouterV2.get("/batches/all", getAllBatchesIncludingInactive);
adminRouterV2.get("/batches/:location?", getAllBatches);
adminRouterV2.get("/batch/:batchId", getBatch);
adminRouterV2.get("/modules", getAllModules);
adminRouterV2.get("/assessments/assessment/:assessmentId", getAssessmentDetails);
adminRouterV2.get("/assessments/:batchId/:assessmentType", getAssessmentsForSpecificBatch); 
adminRouterV2.get("/assessments/:batchId", getAssessmentsDetailsForSpecificBatch);
adminRouterV2.get("/users/trainees/:batchId/:location", getAllTraineesByLocationsAndNotInBatch);
adminRouterV2.get("/locations", getLocations);
adminRouterV2.get("/trainings/all", getAllTrainings);
adminRouterV2.get("/training/:trainingId", getTrainingDetails);
adminRouterV2.get("/user/training/:employeeId", getTrainingsOfUser);
adminRouterV2.get("/user/bacthes/:employeeId", getBatchesOfUser);

/**
 * APIs for graph
 */
adminRouterV2.get("/graph/:employeeId/:batchId?", getAssessmentScoresForTraineeByBatch);

adminRouterV2.post('/bulk/users', upload.single('file'), validateIncomingBulkUsers, bulkUsersFromFile);
adminRouterV2.post('/bulk/test', upload.single('file'), validateIncomingBulkTest, addBulkTestDataofUsers);
adminRouterV2.post("/single/users", validateUser, addUser);
adminRouterV2.post("/single/assessment", validateAddSingleAssessmentDetails, addSingleAssessmentDetails);
adminRouterV2.post("/location/add", addLocation);
adminRouterV2.post("/modules/add", addModules);
adminRouterV2.post("/training/add", validateAddTraining, addTraining);
adminRouterV2.post("/modules/delete", deleteModules);
adminRouterV2.post("/users/delete", deleteUsers);

adminRouterV2.put('/users/toggle-active', toggleUserIsActive);
adminRouterV2.put('/batch/toggle-active', setBatchInactive);
adminRouterV2.put('/users/user/remark', addRemark);
adminRouterV2.put('/users/user/add/batch', validateExistingUserInBatch, addBatchForExistingUser);
adminRouterV2.put("/user/:employeeId/reset-password", resetPassword);
adminRouterV2.put("/user/:employeeId", updateUserDetails);
adminRouterV2.put("/training/:trainingId", updateTraining);
adminRouterV2.put("/training/assign", assignTraining);
adminRouterV2.put("/user/training/:userId", removeTrainingOfUser);
adminRouterV2.put("/user/batche/:userId", removeUserFromBatch);

adminRouterV2.delete("/assessment/:assessmentId", deleteAssessment);
adminRouterV2.delete("/user/delete/:userId", deleteUser);
adminRouterV2.delete("/batch/:batchId", deleteBatch);
adminRouterV2.delete("/location/:locationName", deleteLocation);
adminRouterV2.delete("/training/:trainingId", deleteTraining);
export default adminRouterV2;