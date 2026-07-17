import { Request } from 'express';
import { UserDocument, UserAutomationMetadata, UserRole } from '@shared/types';

export type AutomationSchemaType = 'DO' | 'JC1' | 'JC2' | 'Finishing' | 'FinishingSet';

export interface CheckVersionQueryDto {
  type: AutomationSchemaType;
  localVersion?: string | number;
}

export interface CheckVersionResponseDto<T = Record<string, any>> {
  success: boolean;
  type: AutomationSchemaType;
  version: number;
  fetchedAt: string;
  data?: T;
}

export interface GenerateKeyResponseDto {
  success: boolean;
  plainKey: string;
  message?: string;
}

export interface ResetDeviceResponseDto {
  success: boolean;
  message: string;
}

export interface AutomationAuthenticatedUser extends UserDocument, UserAutomationMetadata {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AutomationAuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role?: string;
  };
  automationUser?: AutomationAuthenticatedUser;
}
