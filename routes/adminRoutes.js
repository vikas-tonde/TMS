import express from "express";
import { upload } from "../middlewares/multerMiddleware.js";
import { addBulkTestDataofUsers, bulkUsersFromFile } from "../controllers/AdminController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware.js";
import { validateIncomingBulkTest } from "../validations/AdminRouteValidations.js";

//const upload = multer({ dest: process.env.FILE_UPLOAD_LOCATION });
const adminRouter = express.Router();

adminRouter.use(authMiddleware);
adminRouter.use(adminAuthMiddleware)
adminRouter.post('/bulk/users', upload.single('file'), bulkUsersFromFile);
adminRouter.post('/bulk/test', upload.single('file'), validateIncomingBulkTest, addBulkTestDataofUsers);

export default adminRouter;