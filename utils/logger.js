import winston from 'winston';
import WinstonDailyRotateFile from 'winston-daily-rotate-file';
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

const logLevels = {
  levels: {
    audit: 0,  // Your custom level
    error: 1,
    warn: 2,
    info: 3,
    http: 4,
    verbose: 5,
    debug: 6,
    silly: 7,
  },
  colors: {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'grey',
    audit: 'magenta',  // Custom color for userActivity
  }
};


const logger = winston.createLogger({
  levels: logLevels.levels,
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: winston.format.combine(
    winston.format.timestamp({
      format: formatTimestamp,
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    // winston.format.json()
    winston.format.printf(({ level, message, stack, ...rest }) => {
      let formattedMessage = `[${level}] ${message} ${JSON.stringify(rest)}`;
      if (stack) {
        formattedMessage += `\n${stack}`; // Properly append the stack trace with a newline
      }
      return formattedMessage;

    })
  ),
  defaultMeta: { service: "TMS-backend" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.errors({ stack: true }),
      ),
    }),
    new WinstonDailyRotateFile({
      filename: process.env.LOGS_FILE_PATH + '/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d', // Keep logs for 30 days
    }),
    new WinstonDailyRotateFile({
      filename: process.env.LOGS_FILE_PATH + '/audit_%DATE%.log',
      level: 'audit',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',  // Retain logs for 30 days
    }),
  ],
});
winston.addColors(logLevels.colors);


// Handle uncaught exceptions
winston.exceptions.handle(
  new winston.transports.Console(),
  new winston.transports.File({ filename: process.env.LOGS_FILE_PATH + '/exceptions.log' })
);

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at", promise, "reason:", reason);
});

export default logger;
