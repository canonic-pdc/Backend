import { FirebaseService } from './firebase.service';
import { WriteBatch, DocumentReference } from 'firebase-admin/firestore';

/**
 * Service to abstract Firestore WriteBatch operations with automatic chunking
 * to bypass the 500-operation hard limit.
 */
export class FirestoreBatchService {
  private batches: WriteBatch[] = [];
  private currentBatch: WriteBatch;
  private operationCount = 0;
  private readonly BATCH_LIMIT = 450; // Keep safely below the 500 limit

  constructor() {
    const db = FirebaseService.getInstance().getDb();
    if (!db) throw new Error('Firestore DB not initialized');
    this.currentBatch = db.batch();
    this.batches.push(this.currentBatch);
  }

  private checkAndRotateBatch() {
    if (this.operationCount >= this.BATCH_LIMIT) {
      const db = FirebaseService.getInstance().getDb();
      if (!db) throw new Error('Firestore DB not initialized');
      this.currentBatch = db.batch();
      this.batches.push(this.currentBatch);
      this.operationCount = 0;
    }
  }

  public set(documentRef: DocumentReference, data: any, options?: any): this {
    this.checkAndRotateBatch();
    if (options) {
      this.currentBatch.set(documentRef, data, options);
    } else {
      this.currentBatch.set(documentRef, data);
    }
    this.operationCount++;
    return this;
  }

  public update(documentRef: DocumentReference, data: any): this {
    this.checkAndRotateBatch();
    this.currentBatch.update(documentRef, data);
    this.operationCount++;
    return this;
  }

  public delete(documentRef: DocumentReference): this {
    this.checkAndRotateBatch();
    this.currentBatch.delete(documentRef);
    this.operationCount++;
    return this;
  }

  /**
   * Provides access to the most recently active WriteBatch chunk.
   * Useful for passing a native WriteBatch reference to external services
   * (e.g., schemaMetaService.incrementVersion).
   */
  public getCurrentBatch(): WriteBatch {
    return this.currentBatch;
  }

  /**
   * Commits all chunks sequentially.
   */
  public async commit(): Promise<void> {
    for (const batch of this.batches) {
      await batch.commit();
    }
  }
}
