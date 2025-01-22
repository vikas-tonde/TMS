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

// prisma.$on('query', (e) => {
//     logger.info(`Query: ${e.query} - Params: ${JSON.stringify(e.params)} - Duration: ${e.duration}ms`);
// });

prisma.$on('query', (e) => {
    const cleanedQuery = e.query.replace(/\\([\\"])/g, '$1').replace(/\\/g, '');

    const cleanParams = (params) => {
        if (Array.isArray(params)) {
            return params.map(param => typeof param === 'string' ? param.replace(/\\([\\"])/g, '$1').replace(/\\/g, '') : param);
        }
        if (typeof params === 'object') {
            const cleanedObject = {};
            Object.keys(params).forEach((key) => {
                const value = params[key];
                cleanedObject[key] = typeof value === 'string' ? value.replace(/\\([\\"])/g, '$1').replace(/\\/g, '') : value;
            });
            return cleanedObject;
        }
        if (typeof params === 'string') {
            return params.replace(/\\([\\"])/g, '$1').replace(/\\/g, '');
        }
        return params;
    };

    const cleanedParams = cleanParams(e.params);
    const formattedParams = typeof cleanedParams === 'object' ? JSON.stringify(cleanedParams) : cleanedParams;
    logger.info(`Query: ${cleanedQuery} - Params: ${formattedParams} - Duration: ${e.duration}ms`);
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