import dotenv from 'dotenv';
dotenv.config();

export interface ApiConfig {
  prefix: string;
  version: string;
}

export const apiConfig: ApiConfig = {
  prefix: process.env.API_PREFIX || '/api/v1',
  version: 'v1',
};
