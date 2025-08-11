/*
 * Logger applicatif structuré (Winston)
 * - JSON en production, format lisible en développement
 * - Ne log jamais de données sensibles
 */
const { createLogger, format, transports } = require('winston');

const isProd = process.env.NODE_ENV === 'production';
const level = process.env.LOG_LEVEL || (isProd ? 'info' : 'debug');

const logger = createLogger({
  level,
  format: isProd
    ? format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      )
    : format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ level, message, timestamp, stack, ...meta }) => {
          const base = `${timestamp} [${level}] ${message}`;
          const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return stack ? `${base}\n${stack}${metaStr}` : `${base}${metaStr}`;
        })
      ),
  transports: [new transports.Console()],
});

module.exports = logger;
