// logger.js
import winston from 'winston';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
// Define the log format
const logFormat = winston.format.printf(({ timestamp, level, message }) => {
  return `${timestamp} [${level}] ${message}`;
});

// Create the logger
const logger = winston.createLogger({
  level: 'info',  // Default logging level
  format: winston.format.combine(
    winston.format.timestamp(),
    logFormat
  ),
  transports: [
    // Console log
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    // Rotating file logs
    new WinstonDailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Keep logs for 30 days
    }),
  ],
});

// Handle uncaught exceptions
winston.exceptions.handle(
  new winston.transports.Console(),
  new winston.transports.File({ filename: 'logs/exceptions.log' })
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (ex) => {
  throw ex;
});

export default logger;
