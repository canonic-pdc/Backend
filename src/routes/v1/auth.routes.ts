import { Router } from 'express';
import { ResponseFormatter } from '@shared/responses';
import { requireAuth } from '@shared/middleware/auth.middleware';

const router = Router();

/**
 * GET /api/v1/auth/me
 * Retrieves current verified user profile payload and role.
 */
router.get('/me', requireAuth, (req: any, res) => {
  res.json(
    ResponseFormatter.success(
      req.user,
      'Authenticated user profile retrieved successfully.'
    )
  );
});

export default router;
