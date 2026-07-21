import { Request } from 'express';

export interface UserPrincipal {
  uid: string;
  email?: string;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserPrincipal;
}

export * from './database.types';

