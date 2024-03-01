import express from "express";
import {addUser, allUsers, loginUser} from "../controllers/UserController.js"
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {validateUser, validateLogin} from '../validations/UserValidation.js'

const userRouter = express.Router();

userRouter.post("/login", validateLogin ,loginUser);
userRouter.use(authMiddleware);
userRouter.post("/add", validateUser ,addUser);
userRouter.get("/", allUsers);
export default userRouter;