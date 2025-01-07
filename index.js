import cookieParser from "cookie-parser";
import cors from 'cors';
import dotenv from "dotenv";
import express from "express";
import { readFile } from 'fs/promises';
import helmet from "helmet";
import mongoose from "mongoose";
import morgan from "morgan";
import path, { dirname } from "path";
import swaggerUi from 'swagger-ui-express';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

global.ROOT_DIR = __dirname;

import rootRouter from "./routes/index.js";
import { populateDB, populatePostgre } from "./utils/populateDb.js";
import rootRouterV2 from "./V2/routes/index.js";
import logger from "./utils/logger.js";

const jsonContent = await readFile('./swagger-output.json', 'utf8');
const swaggerOutput = JSON.parse(jsonContent);


dotenv.config();

// const options = {
//     key: fs.readFileSync('server.key'),
//     cert: fs.readFileSync('server.crt')
// };

const options = {
    customCss: '.swagger-ui .topbar { display: none }',
    docExpansion: 'none',  // Collapse all sections (tags) by default
    deepLinking: true,     // Enable deep linking (clicking on a section will take you to its URL)
    defaultModelsExpandDepth: -1,  // Hide models by default
    layout: "BaseLayout",  // Optional: Set a custom layout if needed,
    customSiteTitle: "TMS API documentation"
};


const app = express();
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerOutput, options,));
app.use(helmet());
app.use(cookieParser());
const port = process.env.PORT || 5000;

BigInt.prototype.toJSON = function () {
    return this.toString();
};

app.use(cors({
    credentials: true,
    origin: process.env.CORS_ORIGIN,
    allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
}));

// app.use(bodyParser.json());
app.use(express.json());
app.use(rootRouterV2);
app.use(rootRouter);

// var server = https.createServer(options, app);
mongoose.connect(process.env.MONGO_URL).then((con) => {
    console.log(`Database connected on Host: ${con.connection.host}`);

    app.listen(port, "0.0.0.0", () => console.log(`Server is runnning on port : http://localhost:${port}`));
    populateDB();
    populatePostgre();
})
    .catch((err) => {
        console.log("MONGO db connection failed !!! ", err);
        throw err;
    });

