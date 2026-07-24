import { Router, Response } from 'express';
import { ResponseFormatter } from '@shared/responses';
import { requireAuth, requireRoles } from '@shared/middleware/auth.middleware';
import { validateRequest } from '@shared/middleware/validation.middleware';
import { createPdcSchema, updatePdcSchema } from '@shared/schemas/collections.schema';
import { asyncHandler, MemoryCache } from '@shared/utils';
import { BadRequestError } from '@shared/errors';
import { RootCollectionName } from '@shared/types';
import { CollectionsRepository } from '@infrastructure/repositories/collections.repository';

const router = Router();
const collectionsCache = new MemoryCache<any>(60); // 60 seconds TTL for collections sync data
const repository = new CollectionsRepository();

/**
 * Validates allowed root collections (`DO`, `Job Costing 1`, `Job Costing 2`, `Finishing`, `FinishingSet`).
 */
function validateCollection(colName: string): asserts colName is RootCollectionName & ('Job Costing 1' | 'Job Costing 2' | 'DO' | 'Finishing' | 'FinishingSet') {
  const allowed: RootCollectionName[] = ['Job Costing 1', 'Job Costing 2', 'DO', 'Finishing', 'FinishingSet'];
  if (!allowed.includes(colName as RootCollectionName)) {
    throw new BadRequestError(`Invalid collection name: ${colName}. Allowed: ${allowed.join(', ')}`);
  }
}

/**
 * GET /api/v1/collections/:collectionName
 * Retrieve list of all PDCs inside a collection, including vehicles and detail lists.
 */
router.get('/:collectionName', asyncHandler(async (req: any, res: Response) => {
  const { collectionName } = req.params;
  validateCollection(collectionName);
  
  const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : (limitParam && pageParam > 1 ? (pageParam - 1) * limitParam : undefined);

  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

  const cacheKey = `list:${collectionName}:${limitParam || 'all'}:${offsetParam || 0}`;
  const cachedData = collectionsCache.get(cacheKey);
  if (cachedData) {
    return res.json(ResponseFormatter.success(cachedData, `Retrieved ${cachedData.length} documents from "${collectionName}" (cached).`));
  }

  const allData = await repository.getCollectionDocs(collectionName, limitParam, offsetParam);

  collectionsCache.set(cacheKey, allData);

  res.json(ResponseFormatter.success(allData, `Retrieved ${allData.length} documents from "${collectionName}".`));
}));

/**
 * GET /api/v1/collections/:collectionName/pdc/:pdcName
 * Retrieve specific deep details of a specific PDC.
 */
router.get('/:collectionName/pdc/:pdcName', asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName } = req.params;
  validateCollection(collectionName);

  res.setHeader('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');

  const cacheKey = `pdc:${collectionName}:${pdcName}`; // cache key does not need double sanitation for lookup
  const cachedData = collectionsCache.get(cacheKey);
  if (cachedData) {
    return res.json(ResponseFormatter.success(cachedData, `Retrieved details for PDC "${pdcName}" (cached).`));
  }

  const payload = await repository.getPdcDetails(collectionName, pdcName);

  collectionsCache.set(cacheKey, payload);

  res.json(ResponseFormatter.success(payload, `Retrieved details for PDC "${pdcName}".`));
}));

/**
 * POST /api/v1/collections/:collectionName/pdc
 * Create a new PDC with optional vehicles array.
 * Required roles: admin or editor.
 */
router.post('/:collectionName/pdc', requireAuth, requireRoles(['admin', 'editor']), validateRequest(createPdcSchema), asyncHandler(async (req: any, res: Response) => {
  const { collectionName } = req.params;
  validateCollection(collectionName);

  const creatorEmail = req.user?.email || 'system';
  
  const { sanitizedPdc, vehiclesCount } = await repository.createPdc(collectionName, req.body, creatorEmail);
  
  collectionsCache.invalidatePrefix(`list:${collectionName}`);
  collectionsCache.delete(`pdc:${collectionName}:${sanitizedPdc}`);

  res.status(201).json(ResponseFormatter.success({
    pdcName: sanitizedPdc,
    vehiclesCreated: vehiclesCount
  }, `Created PDC "${sanitizedPdc}" successfully.`));
}));

/**
 * PUT /api/v1/collections/:collectionName/pdc/:pdcName
 * Updates metadata or adds/modifies vehicles in an existing PDC.
 * Required roles: admin or editor.
 */
router.put('/:collectionName/pdc/:pdcName', requireAuth, requireRoles(['admin', 'editor']), validateRequest(updatePdcSchema), asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName } = req.params;
  validateCollection(collectionName);

  const creatorEmail = req.user?.email || 'system';

  const { sanitizedPdcName, vehiclesUpdated } = await repository.updatePdc(collectionName, pdcName, req.body, creatorEmail);

  collectionsCache.invalidatePrefix(`list:${collectionName}`);
  collectionsCache.delete(`pdc:${collectionName}:${sanitizedPdcName}`);

  res.json(ResponseFormatter.success({
    pdcName: sanitizedPdcName,
    vehiclesUpdated
  }, `Updated PDC "${sanitizedPdcName}" successfully.`));
}));

/**
 * DELETE /api/v1/collections/:collectionName/pdc/:pdcName
 * Deletes an entire PDC including all subcollections (vehicles, detail_list).
 * Required role: admin only.
 */
router.delete('/:collectionName/pdc/:pdcName', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName } = req.params;
  validateCollection(collectionName);

  const { sanitizedPdcName } = await repository.deletePdc(collectionName, pdcName);

  collectionsCache.invalidatePrefix(`list:${collectionName}`);
  collectionsCache.delete(`pdc:${collectionName}:${sanitizedPdcName}`);

  res.json(ResponseFormatter.success(null, `Deleted PDC "${sanitizedPdcName}" and all its subcollections from "${collectionName}".`));
}));

/**
 * DELETE /api/v1/collections/:collectionName/pdc/:pdcName/vehicles/:vehicleName
 * Deletes a specific vehicle entry inside a PDC.
 * Required role: admin or editor.
 */
router.delete('/:collectionName/pdc/:pdcName/vehicles/:vehicleName', requireAuth, requireRoles(['admin', 'editor']), asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName, vehicleName } = req.params;
  validateCollection(collectionName);

  const { sanitizedPdcName, sanitizedVehicleName } = await repository.deleteVehicle(collectionName, pdcName, vehicleName);

  collectionsCache.invalidatePrefix(`list:${collectionName}`);
  collectionsCache.delete(`pdc:${collectionName}:${sanitizedPdcName}`);

  res.json(ResponseFormatter.success(null, `Deleted vehicle "${sanitizedVehicleName}" from PDC "${sanitizedPdcName}".`));
}));

export default router;
