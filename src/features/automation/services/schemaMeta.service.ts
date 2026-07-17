import { FieldValue } from 'firebase-admin/firestore';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { logger } from '@infrastructure/logger/winston.logger';
import { AutomationSchemaType } from '../types/automation.types';

/**
 * Service for managing automatic schema version incrementing in /system/schema_meta.
 * Whenever collections (DO, JC1, JC2, Finishing, FinishingSet) are modified via create, update, or delete,
 * this service bumps the schema version and updates updatedAt.
 */
export class SchemaMetaService {
  private static instance: SchemaMetaService;

  private constructor() {}

  public static getInstance(): SchemaMetaService {
    if (!SchemaMetaService.instance) {
      SchemaMetaService.instance = new SchemaMetaService();
    }
    return SchemaMetaService.instance;
  }

  /**
   * Maps root collection names or schema types to SchemaMeta key ('DO' | 'JC1' | 'JC2' | 'Finishing' | 'FinishingSet').
   */
  public getSchemaKey(colNameOrType: string): AutomationSchemaType | null {
    switch (colNameOrType) {
      case 'DO':
        return 'DO';
      case 'Job Costing 1':
      case 'JC1':
        return 'JC1';
      case 'Job Costing 2':
      case 'JC2':
        return 'JC2';
      case 'Finishing':
        return 'Finishing';
      case 'FinishingSet':
        return 'FinishingSet';
      default:
        return null;
    }
  }

  /**
   * Automatically increments the version number and updates updatedAt for the given module in /system/schema_meta.
   */
  public async incrementVersion(colNameOrType: string): Promise<void> {
    const schemaKey = this.getSchemaKey(colNameOrType);
    if (!schemaKey) {
      return; // Not a schema-tracked collection
    }

    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      logger.warn('[SchemaMetaService] Firestore db not initialized. Cannot increment schema version.');
      return;
    }

    try {
      const metaDocRef = db.collection('system').doc('schema_meta');
      const now = new Date().toISOString();

      await metaDocRef.set(
        {
          [schemaKey]: {
            version: FieldValue.increment(1),
            updatedAt: now,
          },
        },
        { merge: true }
      );

      logger.info(`[SchemaMetaService] Successfully incremented schema version for "${schemaKey}"`);
    } catch (error: any) {
      logger.error(`[SchemaMetaService] Failed to increment schema version for "${colNameOrType}": ${error.message || error}`);
    }
  }
}

export default SchemaMetaService.getInstance();

