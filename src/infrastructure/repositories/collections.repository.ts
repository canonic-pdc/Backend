import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { FirestoreBatchService } from '@infrastructure/firebase/firestore-batch.service';
import { VehicleFormatter } from '@shared/utils';
import schemaMetaService from '@features/automation/services/schemaMeta.service';
import { ConflictError, NotFoundError, AppError } from '@shared/errors';
import { JobCosting1Document, JobCosting1Vehicle, DetailListItem } from '@shared/types';
import { Query } from 'firebase-admin/firestore';
import { pLimit } from '@shared/utils';

export class CollectionsRepository {
  private getDb() {
    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      throw new AppError('Firebase Firestore database not initialized', 503);
    }
    return db;
  }

  private sanitizeName(name: string): string {
    if (!name) return 'unknown';
    return name.trim().replace(/[/\\?%*:|"<>]/g, '_');
  }

  async getCollectionDocs(collectionName: string, limitParam?: number, offsetParam?: number) {
    const db = this.getDb();
    let query: Query = db.collection(collectionName);
    
    if (typeof offsetParam === 'number' && !isNaN(offsetParam) && offsetParam > 0) {
      query = query.offset(offsetParam);
    }
    if (typeof limitParam === 'number' && !isNaN(limitParam) && limitParam > 0) {
      query = query.limit(limitParam);
    }

    const rootSnapshot = await query.get();
    const rootDocs = rootSnapshot.docs;
    const limitFn = pLimit(15);

    const allData = await Promise.all(
      rootDocs.map(rootDoc => limitFn(async () => {
        const docId = rootDoc.id;
        const docData = rootDoc.data() as Partial<JobCosting1Document & { batch?: string; warehouseCode?: string }>;

        const [vSnap, dSnap] = await Promise.all([
          db.collection(collectionName).doc(docId).collection('vehicles').get(),
          db.collection(collectionName).doc(docId).collection('detail_list').get()
        ]);

        const vehicles = vSnap.docs.map(v => ({
          id: v.id,
          name: v.id,
          ...(v.data() as Partial<JobCosting1Vehicle>)
        }));

        const detailList = dSnap.docs.map(d => ({
          id: d.id,
          ...(d.data() as Partial<DetailListItem>)
        }));

        return {
          id: docId,
          pdcName: docId,
          batchNumber: docData.batchNumber || docData.batch || '',
          kodeGudang: docData.kodeGudang || docData.warehouseCode || '',
          ...docData,
          vehicles,
          detailList
        };
      }))
    );

    return allData;
  }

  async getPdcDetails(collectionName: string, pdcName: string) {
    const db = this.getDb();
    const sanitizedPdc = this.sanitizeName(pdcName);
    
    const pdcDocRef = db.collection(collectionName).doc(sanitizedPdc);
    const docSnap = await pdcDocRef.get();

    if (!docSnap.exists) {
      throw new NotFoundError(`PDC "${pdcName}" not found in "${collectionName}".`);
    }

    const docData = (docSnap.data() || {}) as Partial<JobCosting1Document & { batch?: string; warehouseCode?: string }>;
    const [vSnap, dSnap] = await Promise.all([
      db.collection(collectionName).doc(sanitizedPdc).collection('vehicles').get(),
      db.collection(collectionName).doc(sanitizedPdc).collection('detail_list').get()
    ]);

    const vehicles = vSnap.docs.map(v => ({
      id: v.id,
      name: v.id,
      ...(v.data() as Partial<JobCosting1Vehicle>)
    }));

    const detailList = dSnap.docs.map(d => ({
      id: d.id,
      ...(d.data() as Partial<DetailListItem>)
    }));

    return {
      id: sanitizedPdc,
      pdcName: sanitizedPdc,
      batchNumber: docData.batchNumber || docData.batch || '',
      kodeGudang: docData.kodeGudang || docData.warehouseCode || '',
      ...docData,
      vehicles,
      detailList
    };
  }

  async createPdc(collectionName: string, pdcData: any, creatorEmail: string) {
    const db = this.getDb();
    const { pdcName, vehicles, batchNumber, kodeGudang } = pdcData;
    
    const sanitizedPdc = this.sanitizeName(pdcName);
    const pdcDocRef = db.collection(collectionName).doc(sanitizedPdc);
    const docSnap = await pdcDocRef.get();

    if (docSnap.exists) {
      throw new ConflictError(`PDC "${sanitizedPdc}" already exists in collection "${collectionName}". Use PUT to update.`);
    }

    const now = new Date().toISOString();
    const batch = new FirestoreBatchService();

    const rootData = {
      pdcName: sanitizedPdc,
      batchNumber: batchNumber || '',
      kodeGudang: kodeGudang || '',
      createdAt: now,
      updatedAt: now,
      createdBy: creatorEmail,
      updatedBy: creatorEmail
    };

    batch.set(pdcDocRef, rootData);

    let vehiclesCount = 0;
    if (Array.isArray(vehicles)) {
      for (const vehicle of vehicles) {
        if (!vehicle.name && !vehicle.vehicleName) continue;
        const vName = vehicle.name || vehicle.vehicleName;
        const sanitizedVehicleName = this.sanitizeName(vName);
        const vehicleDocRef = db.collection(collectionName).doc(sanitizedPdc).collection('vehicles').doc(sanitizedVehicleName);

        const vehicleData = VehicleFormatter.format(collectionName, vehicle, now, creatorEmail);
        batch.set(vehicleDocRef, vehicleData);
        vehiclesCount++;
      }
    }

    await schemaMetaService.incrementVersion(collectionName, batch.getCurrentBatch());
    await batch.commit();

    return { sanitizedPdc, vehiclesCount };
  }

  async updatePdc(collectionName: string, pdcName: string, updateData: any, creatorEmail: string) {
    const db = this.getDb();
    const { vehicles, batchNumber, kodeGudang } = updateData;
    
    const sanitizedPdcName = this.sanitizeName(pdcName);
    const pdcDocRef = db.collection(collectionName).doc(sanitizedPdcName);
    const docSnap = await pdcDocRef.get();

    if (!docSnap.exists) {
      throw new NotFoundError(`PDC "${sanitizedPdcName}" not found in collection "${collectionName}".`);
    }

    const now = new Date().toISOString();
    const batch = new FirestoreBatchService();

    const updatePayload: any = {
      updatedAt: now,
      updatedBy: creatorEmail
    };
    
    if (batchNumber !== undefined) updatePayload.batchNumber = batchNumber;
    if (kodeGudang !== undefined) updatePayload.kodeGudang = kodeGudang;

    batch.update(pdcDocRef, updatePayload);

    let vehiclesUpdated = 0;
    if (Array.isArray(vehicles)) {
      for (const vehicle of vehicles) {
        if (!vehicle.name && !vehicle.vehicleName) continue;
        const vName = vehicle.name || vehicle.vehicleName;
        const sanitizedVehicleName = this.sanitizeName(vName);
        const vehicleDocRef = db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').doc(sanitizedVehicleName);

        const vehicleData = VehicleFormatter.format(collectionName, vehicle, now, creatorEmail);
        batch.set(vehicleDocRef, vehicleData, { merge: true });
        vehiclesUpdated++;
      }
    }

    await schemaMetaService.incrementVersion(collectionName, batch.getCurrentBatch());
    await batch.commit();

    return { sanitizedPdcName, vehiclesUpdated };
  }

  async deletePdc(collectionName: string, pdcName: string) {
    const db = this.getDb();
    const sanitizedPdcName = this.sanitizeName(pdcName);
    
    const pdcDocRef = db.collection(collectionName).doc(sanitizedPdcName);
    const docSnap = await pdcDocRef.get();

    if (!docSnap.exists) {
      throw new NotFoundError(`PDC "${sanitizedPdcName}" not found in collection "${collectionName}".`);
    }

    const batch = new FirestoreBatchService();

    const vehiclesSnap = await db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').get();
    for (const vDoc of vehiclesSnap.docs) {
      batch.delete(db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').doc(vDoc.id));
    }

    const detailsSnap = await db.collection(collectionName).doc(sanitizedPdcName).collection('detail_list').get();
    for (const dDoc of detailsSnap.docs) {
      batch.delete(db.collection(collectionName).doc(sanitizedPdcName).collection('detail_list').doc(dDoc.id));
    }

    batch.delete(pdcDocRef);

    await schemaMetaService.incrementVersion(collectionName, batch.getCurrentBatch());
    await batch.commit();
    
    return { sanitizedPdcName };
  }

  async deleteVehicle(collectionName: string, pdcName: string, vehicleName: string) {
    const db = this.getDb();
    const sanitizedPdcName = this.sanitizeName(pdcName);
    const sanitizedVehicleName = this.sanitizeName(vehicleName);

    const pdcDocRef = db.collection(collectionName).doc(sanitizedPdcName);
    const pdcSnap = await pdcDocRef.get();
    
    if (!pdcSnap.exists) {
      throw new NotFoundError(`PDC "${sanitizedPdcName}" not found.`);
    }

    const vehicleDocRef = db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').doc(sanitizedVehicleName);
    const vehicleSnap = await vehicleDocRef.get();
    
    if (!vehicleSnap.exists) {
      throw new NotFoundError(`Vehicle "${sanitizedVehicleName}" not found inside PDC "${sanitizedPdcName}".`);
    }

    const batch = new FirestoreBatchService();
    batch.delete(vehicleDocRef);

    await schemaMetaService.incrementVersion(collectionName, batch.getCurrentBatch());
    await batch.commit();

    return { sanitizedPdcName, sanitizedVehicleName };
  }
}
