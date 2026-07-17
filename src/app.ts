import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from '@config/index';
import { requestLogger } from '@shared/middleware/request-logger.middleware';
import { notFoundHandler } from '@shared/middleware/not-found.middleware';
import { errorHandler } from '@shared/middleware/error-handler.middleware';
import v1Routes from './routes/v1';

const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors(config.cors));

// Body Parsing Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Custom Request Logger
app.use(requestLogger);

// Versioned APIs Router Mount
app.use(config.api.prefix, v1Routes);

// 404 handler fallback
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
