import { Router } from 'express';
import authRoutes from './auth.routes';
import vehiclesRoutes from './vehicles.routes';
import collectionsRoutes from './collections.routes';
import usersRoutes from './users.routes';
import reconciliationRoutes from './reconciliation.routes';
import exportRoutes from './export.routes';
import ordinanceRoutes from './ordinance.routes';
import systemRoutes from './system.routes';
import healthRoutes from './health.routes';
import automationRoutes from '@features/automation/routes/automation.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/vehicles', vehiclesRoutes);
router.use('/collections', collectionsRoutes);
router.use('/users', usersRoutes);
router.use('/reconciliation', reconciliationRoutes);
router.use('/export', exportRoutes);
router.use('/ordinance', ordinanceRoutes);
router.use('/system', systemRoutes);
router.use('/health', healthRoutes);
router.use('/automation', automationRoutes);

export default router;

