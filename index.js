import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import cors from 'cors';
import mongoose from "mongoose";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import fs from 'fs';
import https from 'https';

import userRouter from "./routes/userRoutes.js"
import adminRouter from "./routes/adminRoutes.js";

dotenv.config({ path: ".env.dev" });

// const options = {
//     key: fs.readFileSync('server.key'),
//     cert: fs.readFileSync('server.crt')
// };

const app = express();
app.use(helmet());
app.use(cookieParser());
const port = process.env.PORT || 5000;

app.use(cors({
    credentials : true,
    origin: process.env.CORS_ORIGIN,
    allowedHeaders : ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

// app.use((req, res, next) => {
//     res.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN),
//         res.header("Access-Control-Allow-Credentials", true),
//         res.header("Access-Control-Allow-Headers",
//             "Origin, X-Requested-With, Content-Type, Accept, Authorization"
//         );
//     if (req.method === 'OPTIONS') {
//         res.header('Access-Control-Allow-Methods',
//             'PUT, PATCH, DELETE, GET, POST,');
//         return res.status(200).json({});
//     }
//     next();
// });
app.use(bodyParser.json());

app.use("/api/users", userRouter);
app.use("/api/admin", adminRouter);

// var server = https.createServer(options, app);
mongoose.connect(process.env.MONGO_URL).then((con) => {
    console.log(`Database connected on Host: ${con.connection.host}`);
    app.listen(port, () => console.log(`Server is runnning on port : http://localhost:${port}`));
})
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
        throw err;
    });