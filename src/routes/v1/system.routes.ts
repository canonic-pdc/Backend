import { Router, Response } from 'express';
import { ResponseFormatter } from '@shared/responses';
import { asyncHandler } from '@shared/utils';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { AppError } from '@shared/errors';

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

/**
 * GET /api/v1/system/schema-meta/versions
 * Lightweight endpoint for Frontend Web dashboard to retrieve the latest schema version numbers across all collections.
 */
router.get('/schema-meta/versions', asyncHandler(async (req: any, res: Response) => {
  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const metaDocRef = db.collection('system').doc('schema_meta');
  const metaSnap = await metaDocRef.get();

  const data = metaSnap.exists ? metaSnap.data() || {} : {};

  res.json(ResponseFormatter.success(data, 'Schema metadata versions retrieved successfully.'));
}));

export default router;
