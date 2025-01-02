import express from "express";
import { validateLogin } from "../../validations/UserValidation.js";
import { addProfileImage, chanegPassword, downloadTraineeSampleFile, getProfileImage, getSelf, loginUser, signOut } from "../controllers/UserController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { imageUpload } from "../middlewares/multerMiddleware.js";

const userRouterv2 = express.Router();

userRouterv2.post("/login", validateLogin, loginUser);
userRouterv2.get("/download/trainee/input", downloadTraineeSampleFile);
userRouterv2.get("/sign-out", signOut);
userRouterv2.use(authMiddleware);
userRouterv2.get("/", getSelf);
userRouterv2.put("/change-password", chanegPassword);
userRouterv2.get('/profile/:imageName', getProfileImage);
userRouterv2.put("/profile/image", imageUpload.single('file'), addProfileImage);

export default userRouterv2;