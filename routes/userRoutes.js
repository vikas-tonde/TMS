import express from "express";
import { getSelf, loginUser } from "../controllers/UserController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateLogin } from '../validations/UserValidation.js';

const userRouter = express.Router();

userRouter.post("/login", validateLogin, loginUser);
userRouter.use(authMiddleware);
userRouter.get("/", getSelf);

export default userRouter;