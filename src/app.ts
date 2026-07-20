import 'tsconfig-paths/register';
import 'module-alias/register';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/index';
import { requestLogger } from './shared/middleware/request-logger.middleware';
import { notFoundHandler } from './shared/middleware/not-found.middleware';
import { errorHandler } from './shared/middleware/error-handler.middleware';
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

// Root health & service status endpoint (helpful for Vercel deployment checks)
app.get(['/', '/api/index', '/api'], (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Canonic API Service is running and operational.',
    environment: config.app.env || 'development',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    endpoints: {
      base: config.api.prefix,
      health: `${config.api.prefix}/health`,
      debug: '/debug',
    },
  });
});

// Diagnostic Debug Endpoint to inspect runtime environment and CORS headers easily
app.get('/debug', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Diagnostic Debug Endpoint',
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    environment: config.app.env || process.env.NODE_ENV || 'development',
    corsOriginEnv: process.env.CORS_ORIGIN || 'not set (using default)',
    requestOrigin: req.headers.origin || 'no origin header passed',
    cwd: process.cwd(),
  });
});

// 404 handler fallback
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
