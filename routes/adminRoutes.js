import express from "express";
import { addBulkTestDataofUsers, addUser, allUsers, bulkUsersFromFile, getAllBatches, getAllModules, getAllTrainees } from "../controllers/AdminController.js";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/multerMiddleware.js";
import { validateIncomingBulkTest, validateIncomingBulkUsers, validateUser } from "../validations/AdminRouteValidations.js";

const adminRouter = express.Router();

adminRouter.use(authMiddleware);
adminRouter.use(adminAuthMiddleware)
adminRouter.post('/bulk/users', upload.single('file'), validateIncomingBulkUsers, bulkUsersFromFile);
adminRouter.get('/trainees/info/:batchId',getAllTrainees)
adminRouter.post('/bulk/test', upload.single('file'), validateIncomingBulkTest, addBulkTestDataofUsers);
adminRouter.get("/trainees/:location?/:batchName?", allUsers);
adminRouter.get("/batches", getAllBatches);
adminRouter.get("/modules", getAllModules);
adminRouter.post("/single/users", validateUser, addUser);
// adminRouter.get("/trainees/dd", get);

export default adminRouter;