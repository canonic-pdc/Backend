import dotenv from 'dotenv';
dotenv.config();

export interface FirebaseConfig {
  apiKey?: string;
  projectId?: string;
  storageBucket?: string;
  serviceAccountPath?: string;
  serviceAccountJson?: string;
}

export const firebaseConfig: FirebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  serviceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS,
  serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT,
};
