import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export interface ValidationTarget {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validation middleware. Validates Express request body, query params, or route parameters against Zod schemas.
 */
export const validateRequest = (target: ValidationTarget) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (target.body) {
        req.body = target.body.parse(req.body);
      }
      if (target.query) {
        req.query = target.query.parse(req.query) as any;
      }
      if (target.params) {
        req.params = target.params.parse(req.params) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));
        next(new ValidationError('Validation constraints failed', formattedErrors));
      } else {
        next(error);
      }
    }
  };
};
