
import express from "express";
import userRouter from "./userRoutes.js";
import adminRouter from "./adminRoutes.js";
import traineeRouter from "./traineeRoutes.js";

const rootRouter = express.Router();

rootRouter.use("/api/users", userRouter);
rootRouter.use("/api/admin", adminRouter);
rootRouter.use("/api/trainee", traineeRouter);

export default rootRouter;