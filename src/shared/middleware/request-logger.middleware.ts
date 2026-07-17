import { Request, Response, NextFunction } from 'express';
import { logger } from '@infrastructure/logger/winston.logger';

/**
 * Middleware tracking and logging HTTP requests and their completion duration.
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.originalUrl} - status: ${res.statusCode} - duration: ${duration}ms`);
  });
  next();
};
