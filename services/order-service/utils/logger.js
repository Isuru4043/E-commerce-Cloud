/**
 * Structured Logger Utility
 * 
 * Provides consistent, structured logging across the service.
 * Each log entry includes: timestamp, service name, level, and message.
 */

const SERVICE_NAME = process.env.SERVICE_NAME || 'unknown-service';

const formatTimestamp = () => new Date().toISOString();

const formatLog = (level, message, meta = {}) => {
  const entry = {
    timestamp: formatTimestamp(),
    service: SERVICE_NAME,
    level,
    message,
    ...meta,
  };
  return JSON.stringify(entry);
};

const logger = {
  info: (message, meta = {}) => {
    console.log(formatLog('INFO', message, meta));
  },

  warn: (message, meta = {}) => {
    console.warn(formatLog('WARN', message, meta));
  },

  error: (message, meta = {}) => {
    console.error(formatLog('ERROR', message, meta));
  },

  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(formatLog('DEBUG', message, meta));
    }
  },

  request: (req, meta = {}) => {
    console.log(formatLog('INFO', `${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
      ...meta,
    }));
  },
};

export default logger;
