import winston from 'winston';
import path from 'path';
import fs from 'fs';

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'testmarks' },
  transports: [
    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  );
}

// Export logger functions
export function error(message: string, meta?: Record<string, unknown>): void {
  logger.error(message, meta);
}

export function warn(message: string, meta?: Record<string, unknown>): void {
  logger.warn(message, meta);
}

export function info(message: string, meta?: Record<string, unknown>): void {
  logger.info(message, meta);
}

export function debug(message: string, meta?: Record<string, unknown>): void {
  logger.debug(message, meta);
}

export function http(message: string, meta?: Record<string, unknown>): void {
  logger.http(message, meta);
}

// Log with custom level
export function log(level: string, message: string, meta?: Record<string, unknown>): void {
  logger.log(level, message, meta);
}

// Create child logger with additional context
export function createChildLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

// Export the logger instance for advanced usage
export default logger;


