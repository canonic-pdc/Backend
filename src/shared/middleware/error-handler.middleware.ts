import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../errors';
import { ResponseFormatter } from '../responses';
import { logger } from '@infrastructure/logger/winston.logger';

/**
 * Express error handler middleware. Standardizes error responses across all APIs.
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  let statusCode = 500;
  let message = 'Internal Server Error';
  let errors: any = null;

  if (err instanceof AppError || ('statusCode' in err && typeof (err as any).statusCode === 'number')) {
    statusCode = (err as any).statusCode || 500;
    message = err.message;
    if (err instanceof ValidationError || ('errors' in err && Boolean((err as any).errors))) {
      errors = (err as any).errors;
    }
  } else {
    // Log non-operational, unexpected errors
    logger.error(err);
  }

  const response = ResponseFormatter.error(message, errors);

  // In local development, attach full stacks to response for easier debugging
  if (process.env.NODE_ENV === 'development' && !(err instanceof AppError)) {
    (response as any).stack = err.stack;
  }

  res.status(statusCode).json(response);
};
