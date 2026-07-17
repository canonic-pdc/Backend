import { Request } from 'express';

export interface UserPrincipal {
  uid: string;
  email?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPrincipal;
}

export type AsyncRequestHandler = (
  req: Request,
  res: any,
  next: any
) => Promise<any> | any;

export * from './database.types';
