import express from "express";
import multer from "multer";
import { upload } from "../middlewares/multerMiddleware.js";
import { bulkUsersFromFile } from "../controllers/AdminController.js";

//const upload = multer({ dest: process.env.FILE_UPLOAD_LOCATION });
const adminRouter = express.Router();

adminRouter.post('/bulk/users', upload.single('file'), bulkUsersFromFile);

export default adminRouter;