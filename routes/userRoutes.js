import express from "express";
import { chanegPassword, getSelf, loginUser, signOut } from "../controllers/UserController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateLogin } from '../validations/UserValidation.js';

const userRouter = express.Router();

userRouter.post("/login", validateLogin, loginUser);
userRouter.get("/sign-out", signOut);
userRouter.use(authMiddleware);
userRouter.get("/", getSelf);
userRouter.put("/change-password", chanegPassword);

export default userRouter;