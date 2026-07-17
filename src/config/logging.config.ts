import dotenv from 'dotenv';
dotenv.config();

export interface LoggingConfig {
  level: string;
}

export const loggingConfig: LoggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
};
