import { initializeApp, getApps, App, AppOptions, cert, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { config } from '@config/index';

/**
 * Service for Firebase Admin SDK initialization.
 * Initializes and provides instances of App and Firestore.
 */
export class FirebaseService {
  private static instance: FirebaseService;
  private app: App | null = null;
  private db: Firestore | null = null;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): FirebaseService {
    if (!FirebaseService.instance) {
      FirebaseService.instance = new FirebaseService();
    }
    return FirebaseService.instance;
  }

  private initialize(): void {
    const fbConfig = config.firebase;
    try {
      if (getApps().length > 0) {
        this.app = getApps()[0] || null;
      } else {
        const adminOptions: AppOptions = {};

        if (fbConfig.projectId) {
          adminOptions.projectId = fbConfig.projectId;
        }
        if (fbConfig.storageBucket) {
          adminOptions.storageBucket = fbConfig.storageBucket;
        }

        if (fbConfig.serviceAccountJson) {
          try {
            const parsedServiceAccount = typeof fbConfig.serviceAccountJson === 'string'
              ? JSON.parse(fbConfig.serviceAccountJson)
              : fbConfig.serviceAccountJson;
            adminOptions.credential = cert(parsedServiceAccount);
          } catch (e) {
            console.warn('[FirebaseService] Could not parse serviceAccountJson, trying other credentials:', e);
          }
        } else if (fbConfig.serviceAccountPath) {
          try {
            const absolutePath = path.resolve(fbConfig.serviceAccountPath);
            if (fs.existsSync(absolutePath)) {
              const serviceAccountFile = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
              adminOptions.credential = cert(serviceAccountFile);
            }
          } catch (e) {
            console.warn('[FirebaseService] Could not load serviceAccountPath:', e);
          }
        } else if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL && fbConfig.projectId) {
          adminOptions.credential = cert({
            projectId: fbConfig.projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          });
        } else if (fbConfig.projectId) {
          // Fallback to Application Default Credentials or GCP/Vercel serverless environment
          try {
            adminOptions.credential = applicationDefault();
          } catch (adcErr) {
            console.warn('[FirebaseService] Application Default Credentials not available, initializing with projectId only:', adcErr);
          }
        }

        if (Object.keys(adminOptions).length > 0 || fbConfig.projectId) {
          this.app = initializeApp(adminOptions);
        }
      }

      if (this.app) {
        this.db = getFirestore(this.app);
        console.log(`[FirebaseService] Firebase Admin SDK initialized successfully for Project ID: ${fbConfig.projectId || this.app.options.projectId || 'unknown'}`);
      } else {
        console.warn('[FirebaseService] Firebase Admin configuration incomplete. Service is uninitialized.');
      }
    } catch (error) {
      console.error('[FirebaseService] Error initializing Firebase Admin SDK:', error);
    }
  }

  public getApp(): App | null {
    return this.app;
  }

  public getDb(): Firestore | null {
    return this.db;
  }
}


