import { Request, Response, NextFunction } from 'express';

/**
 * Wraps an asynchronous handler function to catch potential errors and delegate them to Express next().
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export * from './concurrency.util';
export * from './cache.util';

