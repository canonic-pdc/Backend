import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { BadRequestError } from '@shared/errors';

export const validateRequest = (schema: ZodSchema<any>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      if (error instanceof ZodError) {
        const messages = error.issues.map((err: any) => `${err.path.join('.')}: ${err.message}`).join(', ');
        next(new BadRequestError(`Validation failed: ${messages}`));
      } else {
        next(error);
      }
    }
  };
};
