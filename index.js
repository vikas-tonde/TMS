import cookieParser from "cookie-parser";
import cors from 'cors';
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import os from 'os';

import adminRouter from "./routes/adminRoutes.js";
import traineeRouter from "./routes/traineeRoutes.js";
import userRouter from "./routes/userRoutes.js";

dotenv.config();

// const options = {
//     key: fs.readFileSync('server.key'),
//     cert: fs.readFileSync('server.crt')
// };

const app = express();
app.use(helmet());
app.use(cookieParser());
const port = process.env.PORT || 5000;
const hostname = os.hostname();

app.use(cors({
    credentials: true,
    origin: process.env.CORS_ORIGIN,
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));
app.use(morgan('dev'));

// app.use(bodyParser.json());
app.use(express.json());

app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);
app.use("/api/trainee", traineeRouter);

// var server = https.createServer(options, app);
mongoose.connect(process.env.MONGO_URL).then((con) => {
    console.log(`Database connected on Host: ${con.connection.host}`);

    app.listen(port, () => console.log(`Server is runnning on port : http://${hostname}:${port}`));
})
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
        throw err;
    });