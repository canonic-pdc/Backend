import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from '../errors';

/**
 * Middleware handling non-matching requests by throwing a NotFoundError.
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  next(new NotFoundError(`Route ${req.method} ${req.originalUrl} does not exist`));
};
