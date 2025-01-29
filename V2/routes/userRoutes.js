import express from "express";
import { validateLogin } from "../../validations/UserValidation.js";
import { addAppPassword, addProfileImage, chanegPassword, downloadMarksheetSample, downloadTraineeSampleFile, getProfileImage, getSelf, loginUser, signOut, toggleMail } from "../controllers/UserController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { handleImageUploadError, imageUpload } from "../middlewares/multerMiddleware.js";
import { adminAuthMiddleware } from "../middlewares/adminAuthMiddleware.js";

const userRouterv2 = express.Router();

userRouterv2.post("/login", validateLogin, loginUser);
userRouterv2.get("/download/trainee/input", downloadTraineeSampleFile);
userRouterv2.get("/download/marksheet/input", downloadMarksheetSample);
userRouterv2.get("/sign-out", signOut);

userRouterv2.use(authMiddleware);
userRouterv2.get("/", getSelf);
userRouterv2.put("/change-password", chanegPassword);
userRouterv2.get('/profile/:imageName', getProfileImage);
userRouterv2.put("/profile/image", imageUpload.single('file'), handleImageUploadError, addProfileImage);

/** Admin only user route */
userRouterv2.use(adminAuthMiddleware);
userRouterv2.put("/admin/app-password", addAppPassword);
userRouterv2.put("/admin/mails", toggleMail);

export default userRouterv2;