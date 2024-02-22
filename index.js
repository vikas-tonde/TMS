import express from "express";
import dotenv from "dotenv"
import bodyParser from "body-parser";
import cors from 'cors';
import mongoose from "mongoose";


dotenv.config({ path: ".env.dev" });

mongoose.connect(process.env.MONGO_URL).then(() => {
    console.log("Database connected");
});

const app = express();
const port = process.env.PORT;

app.use(cors({
    credentials: true,
    origin: "*"
}));
app.use(bodyParser.json())

app.listen(port, () => console.log(`Server is runnning on port : http://localhost:${port}`));