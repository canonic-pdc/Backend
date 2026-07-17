import dotenv from 'dotenv';
dotenv.config();

export interface SecurityConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
}

export const securityConfig: SecurityConfig = {
  jwtSecret: process.env.JWT_SECRET || 'local-development-secret-key-12345',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
};
