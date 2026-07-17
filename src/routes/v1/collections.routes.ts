import { Router, Response } from 'express';
import { ResponseFormatter } from '@shared/responses';
import { requireAuth, requireRoles } from '@shared/middleware/auth.middleware';
import { asyncHandler } from '@shared/utils';
import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import schemaMetaService from '@features/automation/services/schemaMeta.service';

const router = Router();

/**
 * Validates allowed root collections (`DO`, `Job Costing 1`, `Job Costing 2`, `Finishing`, `FinishingSet`).
 */
function validateCollection(colName: string): asserts colName is 'Job Costing 1' | 'Job Costing 2' | 'DO' | 'Finishing' | 'FinishingSet' {
  const allowed = ['Job Costing 1', 'Job Costing 2', 'DO', 'Finishing', 'FinishingSet'];
  if (!allowed.includes(colName)) {
    throw new Error(`Invalid collection name: ${colName}. Allowed: ${allowed.join(', ')}`);
  }
}

/**
 * Helper to sanitize PDC names and Vehicle names
 */
function sanitizeName(name: string): string {
  if (!name) return 'unknown';
  return name.trim().replace(/[/\\?%*:|"<>]/g, '_');
}

/**
 * GET /api/v1/collections/:collectionName
 * Retrieve list of all PDCs inside a collection, including vehicles and detail lists.
 */
router.get('/:collectionName', requireAuth, asyncHandler(async (req: any, res: Response) => {
  const { collectionName } = req.params;
  validateCollection(collectionName);
  
  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new Error('Firebase Firestore database not initialized');
  }

  const rootSnapshot = await db.collection(collectionName).get();
  const allData: any[] = [];

  for (const rootDoc of rootSnapshot.docs) {
    const docId = rootDoc.id;
    const docData = rootDoc.data();

    // Get vehicles subcollection via Admin SDK
    const vSnap = await db.collection(collectionName).doc(docId).collection('vehicles').get();
    const vehicles = vSnap.docs.map(v => ({
      id: v.id,
      name: v.id,
      ...v.data()
    }));

    // Get detail_list subcollection via Admin SDK
    const dSnap = await db.collection(collectionName).doc(docId).collection('detail_list').get();
    const detailList = dSnap.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    allData.push({
      id: docId,
      pdcName: docId,
      batchNumber: docData.batchNumber || docData.batch || '',
      kodeGudang: docData.kodeGudang || docData.warehouseCode || '',
      ...docData,
      vehicles,
      detailList
    });
  }

  res.json(ResponseFormatter.success(allData, `Retrieved ${allData.length} documents from "${collectionName}".`));
}));

/**
 * GET /api/v1/collections/:collectionName/pdc/:pdcName
 * Retrieve specific deep details of a specific PDC.
 */
router.get('/:collectionName/pdc/:pdcName', requireAuth, asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName } = req.params;
  validateCollection(collectionName);

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new Error('Firebase Firestore database not initialized');
  }

  const sanitizedPdc = sanitizeName(pdcName);
  const pdcDocRef = db.collection(collectionName).doc(sanitizedPdc);
  const docSnap = await pdcDocRef.get();

  if (!docSnap.exists) {
    throw new Error(`PDC "${pdcName}" not found in "${collectionName}".`);
  }

  const docData = docSnap.data() || {};
  const vSnap = await db.collection(collectionName).doc(sanitizedPdc).collection('vehicles').get();
  const vehicles = vSnap.docs.map(v => ({
    id: v.id,
    name: v.id,
    ...v.data()
  }));

  const dSnap = await db.collection(collectionName).doc(sanitizedPdc).collection('detail_list').get();
  const detailList = dSnap.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  res.json(ResponseFormatter.success({
    id: sanitizedPdc,
    pdcName: sanitizedPdc,
    batchNumber: docData.batchNumber || docData.batch || '',
    kodeGudang: docData.kodeGudang || docData.warehouseCode || '',
    ...docData,
    vehicles,
    detailList
  }, `Retrieved details for PDC "${pdcName}".`));
}));

/**
 * POST /api/v1/collections/:collectionName/pdc
 * Create a new PDC with optional vehicles array.
 * Required roles: admin or editor.
 */
router.post('/:collectionName/pdc', requireAuth, requireRoles(['admin', 'editor']), asyncHandler(async (req: any, res: Response) => {
  const { collectionName } = req.params;
  validateCollection(collectionName);

  const { pdcName, vehicles, batchNumber, kodeGudang } = req.body;
  if (!pdcName || typeof pdcName !== 'string') {
    throw new Error('Field "pdcName" (string) is required.');
  }

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new Error('Firebase Firestore database not initialized');
  }

  const sanitizedPdc = sanitizeName(pdcName);
  const pdcDocRef = db.collection(collectionName).doc(sanitizedPdc);
  const docSnap = await pdcDocRef.get();

  if (docSnap.exists) {
    throw new Error(`PDC "${sanitizedPdc}" already exists in collection "${collectionName}". Use PUT to update.`);
  }

  const now = new Date().toISOString();
  const creatorEmail = req.user?.email || 'system';

  // 1. Create root document
  const rootData = {
    pdcName: sanitizedPdc,
    batchNumber: batchNumber || '',
    kodeGudang: kodeGudang || '',
    createdAt: now,
    updatedAt: now,
    createdBy: creatorEmail,
    updatedBy: creatorEmail
  };

  await pdcDocRef.set(rootData);

  // 2. Create vehicle subcollection items if provided
  let vehiclesCount = 0;
  if (Array.isArray(vehicles)) {
    for (const vehicle of vehicles) {
      if (!vehicle.name && !vehicle.vehicleName) continue;
      const vName = vehicle.name || vehicle.vehicleName;
      const sanitizedVehicleName = sanitizeName(vName);
      const vehicleDocRef = db.collection(collectionName).doc(sanitizedPdc).collection('vehicles').doc(sanitizedVehicleName);

      let vehicleData: any = {};
      if (collectionName === 'Job Costing 1' || collectionName === 'DO') {
        vehicleData = {
          productData: vehicle.productData || {},
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      } else if (collectionName === 'Job Costing 2') {
        vehicleData = {
          code: Array.isArray(vehicle.code) ? vehicle.code : [],
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      } else if (collectionName === 'Finishing') {
        vehicleData = {
          code: vehicle.code || vehicle.productData || {},
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      } else if (collectionName === 'FinishingSet') {
        vehicleData = {
          code: vehicle.code || vehicle.productData || '',
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      }

      await vehicleDocRef.set(vehicleData);
      vehiclesCount++;
    }
  }

  // Auto-increment schema_meta version for this collection
  await schemaMetaService.incrementVersion(collectionName);

  res.status(201).json(ResponseFormatter.success({
    pdcName: sanitizedPdc,
    vehiclesCreated: vehiclesCount
  }, `Created PDC "${sanitizedPdc}" successfully.`));
}));

/**
 * PUT /api/v1/collections/:collectionName/pdc/:pdcName
 * Updates metadata or adds/modifies vehicles in an existing PDC.
 * Required roles: admin or editor.
 */
router.put('/:collectionName/pdc/:pdcName', requireAuth, requireRoles(['admin', 'editor']), asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName } = req.params;
  validateCollection(collectionName);

  const { vehicles, batchNumber, kodeGudang } = req.body;
  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new Error('Firebase Firestore database not initialized');
  }

  const sanitizedPdcName = sanitizeName(pdcName);
  const pdcDocRef = db.collection(collectionName).doc(sanitizedPdcName);
  const docSnap = await pdcDocRef.get();

  if (!docSnap.exists) {
    throw new Error(`PDC "${sanitizedPdcName}" not found in collection "${collectionName}".`);
  }

  const now = new Date().toISOString();
  const creatorEmail = req.user?.email || 'system';

  // 1. Update root document metadata
  const updatePayload: any = {
    updatedAt: now,
    updatedBy: creatorEmail
  };
  if (batchNumber !== undefined) updatePayload.batchNumber = batchNumber;
  if (kodeGudang !== undefined) updatePayload.kodeGudang = kodeGudang;

  await pdcDocRef.update(updatePayload);

  // 2. Upsert vehicles if provided
  let vehiclesUpdated = 0;
  if (Array.isArray(vehicles)) {
    for (const vehicle of vehicles) {
      if (!vehicle.name && !vehicle.vehicleName) continue;
      const vName = vehicle.name || vehicle.vehicleName;
      const sanitizedVehicleName = sanitizeName(vName);
      const vehicleDocRef = db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').doc(sanitizedVehicleName);

      let vehicleData: any = {};
      if (collectionName === 'Job Costing 1' || collectionName === 'DO') {
        vehicleData = {
          productData: vehicle.productData || {},
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      } else if (collectionName === 'Job Costing 2') {
        vehicleData = {
          code: Array.isArray(vehicle.code) ? vehicle.code : [],
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      } else if (collectionName === 'Finishing') {
        vehicleData = {
          code: vehicle.code || vehicle.productData || {},
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      } else if (collectionName === 'FinishingSet') {
        vehicleData = {
          code: vehicle.code || vehicle.productData || '',
          describe: vehicle.describe || '',
          updatedAt: now,
          updatedBy: creatorEmail
        };
      }

      await vehicleDocRef.set(vehicleData);
      vehiclesUpdated++;
    }
  }

  // Auto-increment schema_meta version for this collection
  await schemaMetaService.incrementVersion(collectionName);

  res.json(ResponseFormatter.success({
    pdcName: sanitizedPdcName,
    vehiclesUpdated
  }, `Updated PDC "${sanitizedPdcName}" successfully.`));
}));

/**
 * DELETE /api/v1/collections/:collectionName/pdc/:pdcName
 * Deletes an entire PDC including all subcollections (vehicles, detail_list).
 * Required role: admin only.
 */
router.delete('/:collectionName/pdc/:pdcName', requireAuth, requireRoles(['admin']), asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName } = req.params;
  validateCollection(collectionName);

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new Error('Firebase Firestore database not initialized');
  }

  const sanitizedPdcName = sanitizeName(pdcName);
  const pdcDocRef = db.collection(collectionName).doc(sanitizedPdcName);
  const docSnap = await pdcDocRef.get();

  if (!docSnap.exists) {
    throw new Error(`PDC "${sanitizedPdcName}" not found in collection "${collectionName}".`);
  }

  // Delete subcollections first
  const vehiclesSnap = await db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').get();
  for (const vDoc of vehiclesSnap.docs) {
    await db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').doc(vDoc.id).delete();
  }

  const detailsSnap = await db.collection(collectionName).doc(sanitizedPdcName).collection('detail_list').get();
  for (const dDoc of detailsSnap.docs) {
    await db.collection(collectionName).doc(sanitizedPdcName).collection('detail_list').doc(dDoc.id).delete();
  }

  // Delete parent document
  await pdcDocRef.delete();

  // Auto-increment schema_meta version for this collection
  await schemaMetaService.incrementVersion(collectionName);

  res.json(ResponseFormatter.success(null, `Deleted PDC "${sanitizedPdcName}" and all its subcollections from "${collectionName}".`));
}));

/**
 * DELETE /api/v1/collections/:collectionName/pdc/:pdcName/vehicles/:vehicleName
 * Deletes a specific vehicle entry inside a PDC.
 * Required role: admin or editor.
 */
router.delete('/:collectionName/pdc/:pdcName/vehicles/:vehicleName', requireAuth, requireRoles(['admin', 'editor']), asyncHandler(async (req: any, res: Response) => {
  const { collectionName, pdcName, vehicleName } = req.params;
  validateCollection(collectionName);

  const db = FirebaseService.getInstance().getDb();
  if (!db) {
    throw new Error('Firebase Firestore database not initialized');
  }

  const sanitizedPdcName = sanitizeName(pdcName);
  const sanitizedVehicleName = sanitizeName(vehicleName);

  const pdcDocRef = db.collection(collectionName).doc(sanitizedPdcName);
  const pdcSnap = await pdcDocRef.get();
  if (!pdcSnap.exists) {
    throw new Error(`PDC "${sanitizedPdcName}" not found.`);
  }

  const vehicleDocRef = db.collection(collectionName).doc(sanitizedPdcName).collection('vehicles').doc(sanitizedVehicleName);
  const vehicleSnap = await vehicleDocRef.get();
  if (!vehicleSnap.exists) {
    throw new Error(`Vehicle "${sanitizedVehicleName}" not found inside PDC "${sanitizedPdcName}".`);
  }

  await vehicleDocRef.delete();

  // Auto-increment schema_meta version for this collection
  await schemaMetaService.incrementVersion(collectionName);

  res.json(ResponseFormatter.success(null, `Deleted vehicle "${sanitizedVehicleName}" from PDC "${sanitizedPdcName}".`));
}));

export default router;
