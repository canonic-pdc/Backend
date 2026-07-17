import { Router } from 'express';
import { ResponseFormatter } from '@shared/responses';

const router = Router();

/**
 * GET /api/v1/reconciliation
 * Retrieve reconciliation records list mock.
 */
router.get('/', (req, res) => {
  res.json(
    ResponseFormatter.success(
      [
        {
          id: 'rec-1',
          date: '2026-07-10',
          status: 'matched',
          totalItems: 145,
          discrepancies: 0,
        },
        {
          id: 'rec-2',
          date: '2026-07-09',
          status: 'discrepancy_found',
          totalItems: 130,
          discrepancies: 3,
        },
      ],
      'Reconciliation reports list retrieved.'
    )
  );
});

export default router;
