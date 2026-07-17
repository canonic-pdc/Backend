import { Router } from 'express';
import { ResponseFormatter } from '@shared/responses';

const router = Router();

/**
 * GET /api/v1/system/info
 * Retrieves metadata details of the running platform host environment.
 */
router.get('/info', (req, res) => {
  res.json(
    ResponseFormatter.success(
      {
        version: '1.0.0',
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
      },
      'System specifications loaded.'
    )
  );
});

export default router;
