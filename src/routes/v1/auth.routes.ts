import { Router } from 'express';
import { ResponseFormatter } from '@shared/responses';
import { requireAuth } from '@shared/middleware/auth.middleware';

const router = Router();

/**
 * POST /api/v1/auth/login
 * Public authentication trigger. Frontend hits this after OAuth Gmail sign-in
 * to trigger backend verification, registration sync, and session validation.
 */
router.post('/login', requireAuth, (req: any, res) => {
  res.json(
    ResponseFormatter.success(
      {
        user: req.user,
      },
      'Login verified and synced successfully.'
    )
  );
});

/**
 * POST /api/v1/auth/logout
 * Authentication logout placeholder.
 */
router.post('/logout', (req, res) => {
  res.json(ResponseFormatter.success(null, 'Logged out successfully.'));
});

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
