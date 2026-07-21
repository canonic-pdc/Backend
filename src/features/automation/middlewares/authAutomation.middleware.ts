import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { UnauthorizedError, ForbiddenError, BadRequestError, AppError } from '@shared/errors';
import { AutomationAuthenticatedRequest, AutomationAuthenticatedUser } from '../types/automation.types';

/**
 * Middleware proteksi untuk endpoint automation API CLI.
 * Memvalidasi Bearer Token hash (SHA-256), mengecek status key, role,
 * serta mengelola Device ID Binding (1 Key = 1 Device).
 */
export const authAutomationMiddleware = async (
  req: AutomationAuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const deviceId = req.headers['x-device-id'];
    const deviceName = req.headers['x-device-name'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Missing or malformed Authorization header'));
    }

    if (!deviceId || typeof deviceId !== 'string' || !deviceId.trim()) {
      return next(new BadRequestError('Missing required header: X-Device-ID'));
    }

    const apiKey = authHeader.split(' ')[1].trim();
    if (!apiKey) {
      return next(new UnauthorizedError('Missing API Key in Authorization header'));
    }

    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      return next(new AppError('Firebase Database not initialized', 503));
    }

    // SHA-256 hash
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Query Firestore with limit(1) using single/unique index via Admin SDK
    const querySnap = await db.collection('users').where('automationKeyHash', '==', hashedKey).limit(1).get();

    if (querySnap.empty) {
      return next(new UnauthorizedError('Invalid API Key'));
    }

    const userDoc = querySnap.docs[0];
    const userData = userDoc.data() as AutomationAuthenticatedUser;

    if (userData.automationKeyStatus !== 'active') {
      return next(new UnauthorizedError(`API Key is not active (Status: ${userData.automationKeyStatus || 'unknown'})`));
    }

    // Role check: admin | editor
    if (!userData.role || !['admin', 'editor'].includes(userData.role)) {
      return next(new ForbiddenError('Access forbidden: insufficient role permissions for automation CLI'));
    }

    const now = new Date().toISOString();
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const cleanDeviceId = deviceId.trim();
    const cleanDeviceName = (typeof deviceName === 'string' && deviceName.trim()) ? deviceName.trim() : 'Unknown PC';

    const userRef = db.collection('users').doc(userDoc.id);

    // Auto-Binding / Device Check logic
    if (!userData.registeredDeviceId) {
      // First-time usage scenario: Bind device right now
      await userRef.update({
        registeredDeviceId: cleanDeviceId,
        registeredDeviceName: cleanDeviceName,
        automationLastUsedAt: now,
        automationLastUsedIp: ip,
        updatedAt: now,
      });

      userData.registeredDeviceId = cleanDeviceId;
      userData.registeredDeviceName = cleanDeviceName;
      userData.automationLastUsedAt = now;
      userData.automationLastUsedIp = ip;
    } else if (userData.registeredDeviceId === cleanDeviceId) {
      // Authorized device scenario: Throttled & awaited update to prevent Vercel container freeze issues
      const lastUsedTimestamp = userData.automationLastUsedAt ? new Date(userData.automationLastUsedAt).getTime() : 0;
      const isIpChanged = userData.automationLastUsedIp !== ip;
      const isTimeThrottled = (Date.now() - lastUsedTimestamp) < 60000; // 60 seconds throttle

      if (!isTimeThrottled || isIpChanged) {
        await userRef.update({
          automationLastUsedAt: now,
          automationLastUsedIp: ip,
        }).catch((err) => {
          console.error('[Auth Automation Middleware] Update failed:', err);
        });
      }

      userData.automationLastUsedAt = now;
      userData.automationLastUsedIp = ip;
    } else {
      // Device rejected scenario: ID mismatch
      return next(
        new ForbiddenError(
          'DEVICE_MISMATCH: API Key telah terikat pada perangkat lain. Hubungi Admin untuk reset device binding.'
        )
      );
    }

    req.automationUser = {
      ...userData,
      id: userDoc.id,
    };

    next();
  } catch (error: any) {
    console.error('[Auth Automation Middleware] Error:', error.message);
    next(new UnauthorizedError(`Automation authentication failed: ${error.message}`));
  }
};

