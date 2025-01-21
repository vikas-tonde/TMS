import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";

const prisma = new PrismaClient({
    log: [
        {
            level: 'query',
            emit: 'event',
        },
        {
            level: 'info',
            emit: 'event',
        },
        {
            level: 'warn',
            emit: 'event',
        },
        {
            level: 'error',
            emit: 'event',
        },
    ],
});

prisma.$on('query', (e) => {
    logger.info(`Query: ${e.query} - Params: ${JSON.stringify(e.params)} - Duration: ${e.duration}ms`);
});
prisma.$on('info', (event) => {
    logger.info(`Info: ${event.message}`);
});

prisma.$on('warn', (event) => {
    logger.warn(`Warning: ${event.message}`);
})

prisma.$on('error', (e) => {
    logger.error(`Prisma error: ${e.message}`);
});

export default prisma;