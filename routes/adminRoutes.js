import express from "express";
import { upload } from "../middlewares/multerMiddleware.js";
import { addBulkTestDataofUsers, bulkUsersFromFile, allUsers, getAllBatches } from "../controllers/AdminController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware.js";
import { validateIncomingBulkTest, validateIncomingBulkUsers } from "../validations/AdminRouteValidations.js";

const adminRouter = express.Router();

adminRouter.use(authMiddleware);
adminRouter.use(adminAuthMiddleware)
adminRouter.post('/bulk/users', upload.single('file'), validateIncomingBulkUsers, bulkUsersFromFile);
adminRouter.post('/bulk/test', upload.single('file'), validateIncomingBulkTest, addBulkTestDataofUsers);
adminRouter.get("/trainees/:location?/:batchName?", allUsers);
adminRouter.get("/batches", getAllBatches);
// adminRouter.get("/trainees/dd", get);

export default adminRouter;