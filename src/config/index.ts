import { appConfig } from './app.config';
import { corsConfig } from './cors.config';
import { securityConfig } from './security.config';
import { firebaseConfig } from './firebase.config';
import { loggingConfig } from './logging.config';
import { apiConfig } from './api.config';

export const config = {
  app: appConfig,
  cors: corsConfig,
  security: securityConfig,
  firebase: firebaseConfig,
  logging: loggingConfig,
  api: apiConfig,
};

export default config;
