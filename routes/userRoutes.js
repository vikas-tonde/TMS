import express from "express";
import { chanegPassword, downloadTraineeSampleFile, getSelf, loginUser, signOut } from "../controllers/UserController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateLogin } from '../validations/UserValidation.js';

const userRouter = express.Router();

userRouter.post("/login", validateLogin, loginUser);
userRouter.get("/download/trainee/input", downloadTraineeSampleFile);
userRouter.get("/sign-out", signOut);
userRouter.use(authMiddleware);
userRouter.get("/", getSelf);
userRouter.put("/change-password", chanegPassword);

export default userRouter;