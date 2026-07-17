import { Router, Response } from 'express';
import { ResponseFormatter } from '@shared/responses';
import { requireAuth, requireRoles } from '@shared/middleware/auth.middleware';
import { asyncHandler } from '@shared/utils';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { AppError } from '@shared/errors';

const router = Router();

// Helper to sanitize Ordinance ID
function sanitizeOrdinanceId(title: string): string {
  if (!title) return 'unknown';
  return title.trim().toUpperCase().replace(/[\s/]+/g, '_');
}

/**
 * GET /api/v1/ordinance
 * Get all ordinance documents.
 */
router.get('/', asyncHandler(async (req: any, res: Response) => {
  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  const colRef = db.collection('Ordinance');
  const snapshot = await colRef.get();
  const ordinances = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  res.json(ResponseFormatter.success(ordinances, 'Ordinances retrieved successfully.'));
}));

/**
 * GET /api/v1/ordinance/:id
 * Get a specific ordinance document by ID.
 */
router.get('/:id', asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  const docRef = db.collection('Ordinance').doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new AppError(`Ordinance with ID "${id}" not found.`, 404);
  }

  res.json(ResponseFormatter.success({
    id: docSnap.id,
    ...docSnap.data()
  }, 'Ordinance retrieved successfully.'));
}));

/**
 * POST /api/v1/ordinance
 * Create a new ordinance rule.
 */
router.post('/', requireAuth, requireRoles(['admin', 'editor']), asyncHandler(async (req: any, res: Response) => {
  const { title, mainCode, subCodes = [], status } = req.body;

  if (!title || !mainCode || !status) {
    throw new AppError('Missing required fields: title, mainCode, status', 400);
  }
  if (status !== 'tambah' && status !== 'ganti') {
    throw new AppError("Status must be 'tambah' or 'ganti'", 400);
  }

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  const ordId = sanitizeOrdinanceId(title);
  const docRef = db.collection('Ordinance').doc(ordId);
  
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    throw new AppError(`Ordinance with title/id "${title}" already exists.`, 409);
  }

  const now = new Date().toISOString();
  const creatorEmail = req.user?.email || 'unknown';

  const newOrdinance = {
    title,
    mainCode,
    subCodes: Array.isArray(subCodes) ? subCodes : [subCodes],
    status,
    createdAt: now,
    updatedAt: now,
    updatedBy: creatorEmail
  };

  await docRef.set(newOrdinance);

  res.status(201).json(ResponseFormatter.success({
    id: ordId,
    ...newOrdinance
  }, 'Ordinance created successfully.'));
}));

/**
 * PUT /api/v1/ordinance/:id
 * Update an existing ordinance rule.
 */
router.put('/:id', requireAuth, requireRoles(['admin', 'editor']), asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;
  const { title, mainCode, subCodes, status } = req.body;

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  const docRef = db.collection('Ordinance').doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new AppError(`Ordinance with ID "${id}" not found.`, 404);
  }

  const now = new Date().toISOString();
  const updaterEmail = req.user?.email || 'unknown';
  const currentData = docSnap.data() || {};

  const updatePayload: any = {
    updatedAt: now,
    updatedBy: updaterEmail
  };

  if (title !== undefined) updatePayload.title = title;
  if (mainCode !== undefined) updatePayload.mainCode = mainCode;
  if (subCodes !== undefined) updatePayload.subCodes = Array.isArray(subCodes) ? subCodes : [subCodes];
  if (status !== undefined) {
    if (status !== 'tambah' && status !== 'ganti') {
      throw new AppError("Status must be 'tambah' or 'ganti'", 400);
    }
    updatePayload.status = status;
  }

  await docRef.update(updatePayload);

  res.json(ResponseFormatter.success({
    id,
    ...currentData,
    ...updatePayload
  }, 'Ordinance updated successfully.'));
}));

/**
 * DELETE /api/v1/ordinance/:id
 * Delete an ordinance rule.
 */
router.delete('/:id', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: Response) => {
  const { id } = req.params;

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  const docRef = db.collection('Ordinance').doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new AppError(`Ordinance with ID "${id}" not found.`, 404);
  }

  await docRef.delete();

  res.json(ResponseFormatter.success(null, `Ordinance "${id}" deleted successfully.`));
}));

export default router;
