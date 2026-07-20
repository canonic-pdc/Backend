import http from 'http';
import app from './app';
import config from '@config/index';
import { logger } from '@infrastructure/logger/winston.logger';

const port = config.app.port;
const server = http.createServer(app);

// Handle Uncaught Exceptions
process.on('uncaughtException', (err: Error) => {
  logger.error('Uncaught Exception! Server terminating...');
  logger.error(err);
  process.exit(1);
});

// Handle Server Errors (such as EADDRINUSE when port is occupied)
server.on('error', (error: NodeJS.ErrnoException) => {
  if (error.syscall !== 'listen') {
    throw error;
  }
  if (error.code === 'EADDRINUSE') {
    logger.error(`Port ${port} is already in use (EADDRINUSE).`);
    logger.error(`Another process or keep-alive connection is still holding port ${port}.`);
    logger.error(`To resolve on Windows, kill existing node processes using: taskkill /F /IM node.exe`);
    process.exit(1);
  } else {
    logger.error(`HTTP Server error encountered: ${error.message}`);
    throw error;
  }
});

// Start HTTP Server
server.listen(port, () => {
  logger.info(`Server started in [${config.app.env}] mode running on port ${port}`);
  logger.info(`API endpoints base path: http://localhost:${port}${config.api.prefix}`);
});

// Handle Unhandled Promise Rejections
process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled Promise Rejection! Server terminating...');
  logger.error(reason instanceof Error ? reason : new Error(String(reason)));
  process.exit(1);
});

// Graceful Shutdown handler
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}. Initializing graceful shutdown sequence...`);

  server.close(() => {
    logger.info('HTTP Server stopped accepting new connections.');

    // Future integrations shutdown steps:
    // databaseConnectionPool.close();

    logger.info('Graceful shutdown sequence finished. Exiting process.');
    process.exit(0);
  });

  // Close open keep-alive connections immediately so port releases promptly
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }

  // Force kill connection hang-ups after 10s timeout
  setTimeout(() => {
    logger.error('Shutdown sequence timed out. Forcing process termination.');
    process.exit(1);
  }, 10000);
};

// Listen to termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Listen to nodemon restart signal (SIGUSR2)
process.once('SIGUSR2', () => {
  logger.info('Received SIGUSR2 (nodemon restart). Closing HTTP server and keep-alive connections...');
  server.close(() => {
    logger.info('HTTP Server stopped for nodemon restart.');
    process.kill(process.pid, 'SIGUSR2');
  });
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }
});
