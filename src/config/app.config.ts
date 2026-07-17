import dotenv from 'dotenv';
dotenv.config();

export interface AppConfig {
  port: number;
  env: string;
  apiPrefix: string;
}

export const appConfig: AppConfig = {
  port: parseInt(process.env.PORT || '8000', 10),
  env: process.env.NODE_ENV || 'development',
  apiPrefix: process.env.API_PREFIX || '/api/v1',
};
