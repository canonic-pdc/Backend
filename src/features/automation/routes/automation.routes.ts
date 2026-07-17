import { Router } from 'express';
import { asyncHandler } from '@shared/utils';
import { requireAuth, requireRoles } from '@shared/middleware/auth.middleware';
import { authAutomationMiddleware } from '../middlewares/authAutomation.middleware';
import automationController from '../controllers/automation.controller';

const router = Router();

/**
 * GET /api/v1/automation/schema/check-version
 * Check schema version using CLI automation authentication (SHA-256 Bearer Token + X-Device-ID).
 */
router.get(
  '/schema/check-version',
  asyncHandler(authAutomationMiddleware as any),
  asyncHandler(automationController.checkVersion as any)
);

/**
 * POST /api/v1/automation/keys
 * Generate or regenerate API key for the authenticated frontend user.
 */
router.post(
  '/keys',
  requireAuth,
  asyncHandler(automationController.generateKey as any)
);

/**
 * POST /api/v1/automation/users/:userId/reset-device
 * Reset device ID binding for a user (Admin only).
 */
router.post(
  '/users/:userId/reset-device',
  requireAuth,
  requireRoles(['admin']),
  asyncHandler(automationController.resetDevice as any)
);

export default router;
