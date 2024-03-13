import express from "express";
import { addUser, loginUser, getSelf } from "../controllers/UserController.js"
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { validateUser, validateLogin } from '../validations/UserValidation.js'

const userRouter = express.Router();

userRouter.post("/login", validateLogin, loginUser);
userRouter.use(authMiddleware);
userRouter.get("/", getSelf);
userRouter.post("/add/", validateUser, addUser);

export default userRouter;