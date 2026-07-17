import { Firestore } from 'firebase-admin/firestore';
import { FirebaseService } from '../firebase/firebase.service';

/**
 * Provider for Firestore database using Firebase Admin SDK.
 */
export class FirestoreProvider {
  private static instance: FirestoreProvider;
  private db: Firestore | null = null;

  private constructor() {
    this.initialize();
  }

  public static getInstance(): FirestoreProvider {
    if (!FirestoreProvider.instance) {
      FirestoreProvider.instance = new FirestoreProvider();
    }
    return FirestoreProvider.instance;
  }

  private initialize(): void {
    this.db = FirebaseService.getInstance().getDb();
    if (this.db) {
      console.log('[FirestoreProvider] Firestore Admin SDK client provider attached.');
    } else {
      console.log('[FirestoreProvider] Running database provider in mock/fallback mode.');
    }
  }

  public getDb(): Firestore | null {
    return this.db;
  }
}


