import { Router } from 'express';
import { ResponseFormatter } from '@shared/responses';

const router = Router();

/**
 * GET /api/v1/vehicles
 * Retrieve list of vehicles mock.
 */
router.get('/', (req, res) => {
  res.json(
    ResponseFormatter.success(
      [
        { id: '1', make: 'Toyota', model: 'Camry', year: 2022, licensePlate: 'XYZ-1234' },
        { id: '2', make: 'Ford', model: 'Explorer', year: 2021, licensePlate: 'ABC-5678' },
      ],
      'Vehicles retrieved successfully.'
    )
  );
});

/**
 * POST /api/v1/vehicles
 * Register a new vehicle mock.
 */
router.post('/', (req, res) => {
  res.json(
    ResponseFormatter.success(
      {
        id: '3',
        ...req.body,
      },
      'Vehicle registered successfully.'
    )
  );
});

export default router;
