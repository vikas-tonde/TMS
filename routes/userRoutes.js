import express from "express";
import { addProfileImage, chanegPassword, downloadTraineeSampleFile, getProfileImage, getSelf, loginUser, signOut } from "../controllers/UserController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { imageUpload } from "../middlewares/multerMiddleware.js";
import { validateLogin } from '../validations/UserValidation.js';

const userRouter = express.Router();

userRouter.post("/login", validateLogin, loginUser);
userRouter.get("/download/trainee/input", downloadTraineeSampleFile);
userRouter.get("/sign-out", signOut);
userRouter.use(authMiddleware);
userRouter.get("/", getSelf);
userRouter.put("/change-password", chanegPassword);
userRouter.get('/profile/:imageName', getProfileImage);
userRouter.put("/profile/image", imageUpload.single('file'), addProfileImage);

export default userRouter;