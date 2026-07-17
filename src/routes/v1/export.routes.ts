import { Router } from 'express';
import { ResponseFormatter } from '@shared/responses';

const router = Router();

/**
 * POST /api/v1/export/csv
 * Trigger a CSV data export job placeholder.
 */
router.post('/csv', (req, res) => {
  res.json(
    ResponseFormatter.success(
      {
        jobId: 'export-job-999',
        status: 'pending',
        downloadUrl: 'https://storage.googleapis.com/canonic-exports/vehicles_20260710.csv',
      },
      'Export job triggered successfully.'
    )
  );
});

export default router;
