import { Response } from 'express';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { BadRequestError, UnauthorizedError, AppError } from '@shared/errors';
import { AuthenticatedRequest } from '@shared/types';
import {
  AutomationAuthenticatedRequest,
  AutomationSchemaType,
  CheckVersionResponseDto,
} from '../types/automation.types';
import schemaGeneratorService from '../services/schemaGenerator.service';
import apiKeyService from '../services/apiKey.service';

const VALID_SCHEMA_TYPES: AutomationSchemaType[] = ['DO', 'JC1', 'JC2', 'Finishing', 'FinishingSet'];

export class AutomationController {
  /**
   * GET /api/v1/automation/schema/check-version
   * Mengecek versi skema dan mengembalikan 304 Not Modified bila sama, atau 200 OK berserta JSON Murni bila berbeda.
   */
  public async checkVersion(req: AutomationAuthenticatedRequest, res: Response): Promise<Response | void> {
    const typeQuery = req.query.type as string;
    const localVersionQuery = req.query.localVersion;

    if (!typeQuery || !VALID_SCHEMA_TYPES.includes(typeQuery as AutomationSchemaType)) {
      throw new BadRequestError(
        `Invalid or missing schema query param 'type': ${typeQuery}. Allowed: ${VALID_SCHEMA_TYPES.join(', ')}`
      );
    }

    const type = typeQuery as AutomationSchemaType;
    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      throw new AppError('Firebase Database not initialized', 503);
    }

    // Single document read for schema version checking via Admin SDK
    const metaDocRef = db.collection('system').doc('schema_meta');
    const metaSnap = await metaDocRef.get();

    let serverVersion = 1;
    if (metaSnap.exists) {
      const metaData = metaSnap.data();
      if (metaData && metaData[type] && typeof metaData[type].version === 'number') {
        serverVersion = metaData[type].version;
      }
    }

    const localVersion = localVersionQuery !== undefined && localVersionQuery !== '' ? Number(localVersionQuery) : null;

    // Set CDN cache headers as required
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

    if (localVersion !== null && !isNaN(localVersion) && serverVersion === localVersion) {
      return res.status(304).send();
    }

    // Lazy / On-Demand generation of pure JSON object
    const schemaData = await schemaGeneratorService.getFormattedSchema(type);

    const payload: CheckVersionResponseDto = {
      success: true,
      type,
      version: serverVersion,
      fetchedAt: new Date().toISOString(),
      data: schemaData,
    };

    return res.status(200).json(payload);
  }

  /**
   * POST /api/v1/automation/keys
   * Generate or regenerate secure API key for the authenticated user.
   */
  public async generateKey(req: AuthenticatedRequest, res: Response): Promise<Response> {
    const userId = req.user?.uid;
    if (!userId) {
      throw new UnauthorizedError('User profile not resolved');
    }

    const result = await apiKeyService.generateOrRegenerateKey(userId);
    return res.status(200).json(result);
  }

  /**
   * POST /api/v1/automation/users/:userId/reset-device
   * Admin only: Reset device binding for target user.
   */
  public async resetDevice(req: AuthenticatedRequest, res: Response): Promise<Response> {
    const targetUserId = req.params.userId;
    if (!targetUserId || !targetUserId.trim()) {
      throw new BadRequestError('Target userId is required');
    }

    const result = await apiKeyService.resetDeviceBinding(targetUserId.trim());
    return res.status(200).json(result);
  }
}

export default new AutomationController();
