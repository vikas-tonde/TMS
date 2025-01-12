import express from "express";
import userRouter from "./userRoutes.js";
import adminRouter from "./adminRoutes.js";
import traineeRouter from "./traineeRoutes.js";

const rootRouterV2 = express.Router();

rootRouterV2.use("/v2/api/users", userRouter);
rootRouterV2.use("/v2/api/admin", adminRouter);
rootRouterV2.use("/v2/api/trainee", traineeRouter);

export default rootRouterV2;