import { Router } from 'express';
import { ResponseFormatter } from '@shared/responses';

const router = Router();

/**
 * GET /api/v1/health
 * Public health-check endpoint returning system operational status and uptime.
 */
router.get('/', (req, res) => {
  res.json(
    ResponseFormatter.success(
      {
        status: 'UP',
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || 'development',
      },
      'System is operational.'
    )
  );
});

export default router;
