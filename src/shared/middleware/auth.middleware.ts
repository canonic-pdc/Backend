import { Response, NextFunction } from 'express';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { AuthenticatedRequest } from '../types';
import { UnauthorizedError, ForbiddenError } from '../errors';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { config } from '@config/index';
import { MemoryCache } from '../utils/cache.util';

export const userRoleCache = new MemoryCache<string>(300); // 5 minutes TTL

/**
 * Helper to verify ID Token using either Firebase Auth REST API or Google OAuth TokenInfo API.
 */
async function verifyToken(token: string, apiKey?: string): Promise<{ uid: string; email: string; name: string; role?: string }> {
  // 0. Try Firebase Admin SDK offline/online verifyIdToken first
  try {
    if (getApps().length > 0 && getApps()[0]) {
      const decoded = await getAuth().verifyIdToken(token);
      if (decoded && decoded.uid) {
        return {
          uid: decoded.uid,
          email: decoded.email || '',
          name: decoded.name || decoded.email?.split('@')[0] || 'User',
          role: typeof decoded.role === 'string' ? decoded.role : undefined,
        };
      }
    }
  } catch {
    // Fallback to REST/tokeninfo below
  }

  // 1. Try Firebase Auth REST API (accounts:lookup)
  if (apiKey) {
    try {
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.users && data.users.length > 0) {
          const user = data.users[0];
          return {
            uid: user.localId,
            email: user.email || '',
            name: user.displayName || user.email?.split('@')[0] || 'User',
          };
        }
      }
    } catch (err: any) {
      console.error('[Auth Middleware] Firebase token verification request failed:', err.message);
    }
  }

  // 2. Fallback to Google OAuth TokenInfo API (direct Gmail OAuth token)
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    if (response.ok) {
      const data = await response.json();
      if (data.sub) {
        return {
          uid: data.sub,
          email: data.email || '',
          name: data.name || data.email?.split('@')[0] || 'User',
        };
      }
    }
  } catch (err: any) {
    console.error('[Auth Middleware] Google TokenInfo verification request failed:', err.message);
  }

  throw new Error('Invalid, expired, or unsupported token');
}

/**
 * Validates request Bearer Tokens (Firebase ID tokens or Google OAuth ID tokens)
 * and resolves or automatically registers the user in the Firestore /users/{uid} document.
 */
export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new UnauthorizedError('Missing or malformed Authorization header'));
  }

  const token = authHeader.split(' ')[1];
  const isDevOrTest = config.app.env === 'development' || config.app.env === 'test';

  // 1. Support development/test mock bypass only when NOT in production
  if (isDevOrTest) {
    if (token === 'mock-admin-token') {
      req.user = { uid: 'mock-admin-uid', email: 'admin@canonic.com', role: 'admin' };
      return next();
    } else if (token === 'mock-user-token') {
      req.user = { uid: 'mock-user-uid', email: 'user@canonic.com', role: 'viewer' };
      return next();
    }
  }

  // 2. Real validation using Firebase Admin / Google APIs
  const apiKey = config.firebase.apiKey;
  if (!apiKey && getApps().length === 0) {

    if (isDevOrTest) {
      console.warn('[Auth Middleware] Firebase not configured. Development fallback mock user active.');
      req.user = { uid: 'placeholder-uid', email: 'dev-placeholder@canonic.com', role: 'viewer' };
      return next();
    } else {
      return next(new UnauthorizedError('Authentication service unavailable: configuration missing'));
    }
  }

  try {
    const decodedUser = await verifyToken(token, apiKey);
    const { uid, email, name, role: claimRole } = decodedUser;

    // 3. Resolve role from custom claims or cache first to avoid expensive Firestore lookup
    let role: string = 'viewer'; // Default fallback role

    if (claimRole) {
      role = claimRole;
      userRoleCache.set(uid, role);
    } else {
      const cachedRole = userRoleCache.get(uid);
      if (cachedRole) {
        role = cachedRole;
      } else {
        const firebaseService = FirebaseService.getInstance();
        const db = firebaseService.getDb();
        
        if (db) {
          try {
            const userDocRef = db.collection('users').doc(uid);
            const userDocSnap = await userDocRef.get();

            if (userDocSnap.exists) {
              const userData = userDocSnap.data() || {};
              role = userData.role || 'viewer';
              console.log(`[Auth Middleware] Resolved existing user: ${email} (Role: ${role})`);
            } else {
              // Auto-registration for new users with default role 'viewer' and explicit null metadata
              console.log(`[Auth Middleware] New user detected: ${email}. Registering with default 'viewer' role.`);
              const now = new Date().toISOString();
              const newUserProfile = {
                id: uid,
                email,
                name,
                role: 'viewer',
                automationKeyHash: null,
                automationKeyPrefix: null,
                automationKeyStatus: null,
                registeredDeviceId: null,
                registeredDeviceName: null,
                automationLastUsedAt: null,
                automationLastUsedIp: null,
                createdAt: now,
                updatedAt: now,
              };
              await userDocRef.set(newUserProfile);
              role = 'viewer';
            }
            userRoleCache.set(uid, role);
          } catch (dbErr: any) {
            console.error('[Auth Middleware] Firestore user operation failed:', dbErr.message);
            if (!isDevOrTest) {
              return next(new UnauthorizedError('User authorization lookup failed'));
            }
            role = 'viewer';
          }
        } else {
          console.warn('[Auth Middleware] Firestore database is not initialized.');
          if (!isDevOrTest) {
            return next(new UnauthorizedError('Database connection unavailable'));
          }
        }
      }
    }

    req.user = { uid, email, role };
    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Authentication process error:', error.message);
    return next(new UnauthorizedError('Authentication failed: ' + error.message));
  }
};


/**
 * Authorization middleware. Requires requireAuth to have run prior.
 */
export const requireRoles = (allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !req.user.role) {
      return next(new UnauthorizedError('User authentication profile not resolved'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ForbiddenError('Access forbidden: insufficient role permissions'));
    }

    next();
  };
};

