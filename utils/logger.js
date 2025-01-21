// logger.js
import winston from 'winston';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
// Define the log format
// const logFormat = winston.format.printf(({ timestamp, level, message }) => {
//   return `${timestamp} [${level}] ${message}`;
// });

// // Create the logger
// const logger = winston.createLogger({
//   level: 'info',  // Default logging level
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     logFormat
//   ),
//   transports: [
//     // Console log
//     new winston.transports.Console({
//       format: winston.format.combine(
//         winston.format.colorize(),
//         winston.format.simple()
//       ),
//     }),
//     // Rotating file logs
// new WinstonDailyRotateFile({
//   filename: 'logs/app-%DATE%.log',
//   datePattern: 'YYYY-MM-DD',
//   maxFiles: '30d', // Keep logs for 30 days
// }),
//   ],
// });

const formatTimestamp = () => {
  const now = new Date();
  return now.toLocaleString('default', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false // To use 24-hour format, change this to true for 12-hour format
  });
};

const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({
      format:formatTimestamp
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta:{service: "TMS-backend"} ,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new WinstonDailyRotateFile({

      filename: process.env.LOGS_FILE_PATH + '/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Keep logs for 30 days
    }),
  ],
});

// Handle uncaught exceptions
winston.exceptions.handle(
  new winston.transports.Console(),
  new winston.transports.File({ filename: process.env.LOGS_FILE_PATH + '/exceptions.log' })
);

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason:", reason);
});

export default logger;
