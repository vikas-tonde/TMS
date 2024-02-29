import express from "express";
import {addUser, allUsers, loginUser} from "../controllers/UserController.js"
import {validateUser, validateLogin} from '../validations/UserValidation.js'

const userRouter = express.Router();


userRouter.post("/add", validateUser ,addUser);
userRouter.post("/login", validateLogin ,loginUser);
userRouter.get("/", allUsers);
export default userRouter;