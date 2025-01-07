import { PrismaClient } from "@prisma/client";
import logger from "../utils/logger.js";
 
const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

// prisma.$on('query', (e) => {
//     logger.info(`Query: ${e.query} - Params: ${JSON.stringify(e.params)} - Duration: ${e.duration}ms`);
//   });
  
//   prisma.$on('error', (e) => {
//     logger.error(`Prisma error: ${e.message}`);
//   });

export default prisma;