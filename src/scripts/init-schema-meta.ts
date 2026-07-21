import dotenv from 'dotenv';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { SchemaMetaDocument } from '@shared/types';

dotenv.config();

async function initSchemaMeta(): Promise<void> {
  console.log('==================================================');
  console.log('       INITIALIZING SYSTEM SCHEMA METADATA        ');
  console.log('==================================================');

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new Error('[Init] Firebase Admin SDK database could not be initialized. Check environment variables.');
  }

  const metaDocRef = db.collection('system').doc('schema_meta');
  const metaSnap = await metaDocRef.get();

  if (metaSnap.exists) {
    console.log('[Init] Document /system/schema_meta already exists:');
    console.log(JSON.stringify(metaSnap.data(), null, 2));
    console.log('[Init] No initialization needed.');
    return;
  }

  const now = new Date().toISOString();
  const initialData: SchemaMetaDocument = {
    DO: { version: 1, updatedAt: now },
    JC1: { version: 1, updatedAt: now },
    JC2: { version: 1, updatedAt: now },
    Finishing: { version: 1, updatedAt: now },
    FinishingSet: { version: 1, updatedAt: now },
    Ordinance: { version: 1, updatedAt: now },
  };

  await metaDocRef.set(initialData);
  console.log('[Init] Successfully created /system/schema_meta with initial data via Firebase Admin SDK:');
  console.log(JSON.stringify(initialData, null, 2));
  console.log('==================================================');
}

initSchemaMeta().catch((error) => {
  console.error('[Fatal Error] Failed to initialize schema_meta:', error);
  process.exit(1);
});

