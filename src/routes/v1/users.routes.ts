import { Router, Response } from 'express';
import { ResponseFormatter } from '@shared/responses';
import { requireAuth, requireRoles, userRoleCache } from '@shared/middleware/auth.middleware';
import { asyncHandler } from '@shared/utils';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { AppError } from '@shared/errors';
import { UserRole } from '@shared/types';
import { Query } from 'firebase-admin/firestore';

const router = Router();

// Middleware boundary: all user management routes require admin role
router.use(requireAuth, requireRoles(['admin']));

/**
 * GET /api/v1/users
 * Retrieve list of all users from the database (Admin only).
 */
router.get('/', asyncHandler(async (req: any, res: Response) => {
  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  res.setHeader('Cache-Control', 'private, max-age=30, stale-while-revalidate=120');

  const limitParam = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const pageParam = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const offsetParam = req.query.offset ? parseInt(req.query.offset as string, 10) : (limitParam && pageParam > 1 ? (pageParam - 1) * limitParam : undefined);

  let query: Query = db.collection('users');
  if (typeof offsetParam === 'number' && !isNaN(offsetParam) && offsetParam > 0) {
    query = query.offset(offsetParam);
  }
  if (typeof limitParam === 'number' && !isNaN(limitParam) && limitParam > 0) {
    query = query.limit(limitParam);
  }

  const snapshot = await query.get();
  const docs = snapshot.docs;

  const users = docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  res.json(ResponseFormatter.success(users, 'User profiles list retrieved successfully.'));
}));

/**
 * PUT /api/v1/users/:userId/role
 * Update role configuration of a specific user (Admin only).
 */
router.put('/:userId/role', asyncHandler(async (req: any, res: Response) => {
  const { userId } = req.params;
  const { role } = req.body;

  const validRoles: UserRole[] = ['admin', 'editor', 'viewer'];
  if (!role || !validRoles.includes(role)) {
    throw new AppError(`Invalid role: ${role}. Valid roles: ${validRoles.join(', ')}`, 400);
  }

  // Prevent self-demotion to avoid locking out the last admin
  if (req.user?.uid === userId && role !== 'admin') {
    throw new AppError('Self-demotion is not allowed. Admin cannot revoke their own admin permissions.', 400);
  }

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  const docRef = db.collection('users').doc(userId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new AppError(`User with ID "${userId}" not found.`, 404);
  }

  const now = new Date().toISOString();
  await docRef.update({
    role,
    updatedAt: now
  });
  userRoleCache.delete(userId);

  res.json(ResponseFormatter.success({
    id: userId,
    ...docSnap.data(),
    role,
    updatedAt: now
  }, `User role updated to "${role}" successfully.`));
}));

/**
 * DELETE /api/v1/users/:userId
 * Remove a user profile from the database (Admin only).
 */
router.delete('/:userId', asyncHandler(async (req: any, res: Response) => {
  const { userId } = req.params;

  // Prevent self-deletion
  if (req.user?.uid === userId) {
    throw new AppError('Self-deletion is not allowed.', 400);
  }

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new AppError('Firebase Database not initialized', 503);
  }

  const docRef = db.collection('users').doc(userId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new AppError(`User with ID "${userId}" not found.`, 404);
  }

  await docRef.delete();
  userRoleCache.delete(userId);

  res.json(ResponseFormatter.success(null, `User "${userId}" profile deleted successfully.`));
}));

export default router;
