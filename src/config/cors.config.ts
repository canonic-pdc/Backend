import { CorsOptions } from 'cors';
import dotenv from 'dotenv';
dotenv.config();

const parseCorsOrigin = (): CorsOptions['origin'] => {
  const originEnv = process.env.CORS_ORIGIN || 'http://localhost:5173';
  if (originEnv === '*') return true; // Reflects incoming origin when '*' is set, satisfying credentials: true
  if (originEnv.includes(',')) {
    return originEnv.split(',').map((o) => o.trim());
  }
  return originEnv;
};

export const corsConfig: CorsOptions = {
  origin: parseCorsOrigin(),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
