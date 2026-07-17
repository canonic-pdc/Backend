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

/**
 * Custom pause utility (for test stubs or background simulation).
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
