import express from "express";
import dotenv from "dotenv"
import bodyParser from "body-parser";
import cors from 'cors';
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import userRouter from "./routes/userRoutes.js"

dotenv.config({ path: ".env.dev" });

mongoose.connect(process.env.MONGO_URL).then(() => {
    console.log("Database connected");
});

const app = express();
app.use(helmet());
app.use(cookieParser());
const port = process.env.PORT;

app.use(cors({
    credentials: true,
    origin: "*"
}));
app.use(bodyParser.json())

app.use("/api/users", userRouter);


app.listen(port, () => console.log(`Server is runnning on port : http://localhost:${port}`));