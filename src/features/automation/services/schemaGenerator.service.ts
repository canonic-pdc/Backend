import { FirebaseService } from '@infrastructure/firebase/firebase.service';
import { AppError } from '@shared/errors';
import { AutomationSchemaType } from '../types/automation.types';

interface RawPdcData {
  id: string;
  batchNumber: string;
  warehouseCode: string;
  vehicles: any[];
}

export class SchemaGeneratorService {
  private static instance: SchemaGeneratorService;

  private constructor() {}

  public static getInstance(): SchemaGeneratorService {
    if (!SchemaGeneratorService.instance) {
      SchemaGeneratorService.instance = new SchemaGeneratorService();
    }
    return SchemaGeneratorService.instance;
  }

  public async getFormattedSchema(type: AutomationSchemaType): Promise<Record<string, any>> {
    const pdcList = await this.fetchRootAndVehicles(type);

    switch (type) {
      case 'DO':
        return this.buildDOSchema(pdcList);
      case 'JC1':
        return this.buildJC1Schema(pdcList);
      case 'JC2':
        return this.buildJC2Schema(pdcList);
      case 'Finishing':
        return this.buildFinishingSchema(pdcList);
      case 'FinishingSet':
        return this.buildFinishingSetSchema(pdcList);
      default:
        throw new Error(`Unsupported schema type: ${type}`);
    }
  }

  private getCollectionName(type: AutomationSchemaType): string {
    switch (type) {
      case 'DO':
        return 'DO';
      case 'JC1':
        return 'Job Costing 1';
      case 'JC2':
        return 'Job Costing 2';
      case 'Finishing':
        return 'Finishing';
      case 'FinishingSet':
        return 'FinishingSet';
    }
  }

  private async fetchRootAndVehicles(type: AutomationSchemaType): Promise<RawPdcData[]> {
    const db = FirebaseService.getInstance().getDb();
    if (!db) {
      throw new AppError('Firebase Database not initialized', 503);
    }

    const colName = this.getCollectionName(type);
    const rootSnap = await db.collection(colName).get();

    if (rootSnap.empty) {
      return [];
    }

    const pdcList = await Promise.all(
      rootSnap.docs.map(async (rootDoc) => {
        const docId = rootDoc.id;
        const docData = rootDoc.data();
        const vSnap = await db.collection(colName).doc(docId).collection('vehicles').get();
        const vehicles = vSnap.docs.map((v) => ({
          id: v.id,
          ...v.data(),
        }));
        return {
          id: docId,
          batchNumber: docData.batchNumber || '',
          warehouseCode: docData.kodeGudang || docData.warehouseCode || '',
          vehicles,
        };
      })
    );

    return pdcList;
  }


  private extractVehicleName(vehicle: any): string {
    if (vehicle.mobil && Array.isArray(vehicle.mobil) && vehicle.mobil.length > 0) {
      return String(vehicle.mobil[0]).trim();
    }
    if (vehicle.mobil && typeof vehicle.mobil === 'string') {
      return vehicle.mobil.trim();
    }
    return String(vehicle.id || 'Unknown').trim();
  }

  private extractDescribe(vehicle: any): string {
    if (vehicle.describe && Array.isArray(vehicle.describe) && vehicle.describe.length > 0) {
      return String(vehicle.describe[0]).trim();
    }
    if (vehicle.describe && typeof vehicle.describe === 'string') {
      return vehicle.describe.trim();
    }
    return '';
  }

  private buildDOSchema(pdcList: RawPdcData[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const pdc of pdcList) {
      const pdcName = pdc.id.trim();
      const vehicleModels: Record<string, any> = {};
      for (const vehicle of pdc.vehicles) {
        const vehicleName = this.extractVehicleName(vehicle);
        const describe = this.extractDescribe(vehicle);
        let code = '';
        let client = '';
        const codeObj = vehicle.productData || vehicle.code;

        if (codeObj && typeof codeObj === 'object' && !Array.isArray(codeObj)) {
          const entries = Object.entries(codeObj);
          if (entries.length > 0) {
            client = entries[0][0];
            code = String(entries[0][1]);
          }
        } else if (Array.isArray(codeObj)) {
          code = String(codeObj[0] || '');
        } else if (codeObj !== undefined && codeObj !== null) {
          code = String(codeObj);
        }

        vehicleModels[vehicleName] = {
          describe,
          code,
          client,
        };
      }
      result[pdcName] = {
        batchNumber: pdc.batchNumber,
        warehouseCode: pdc.warehouseCode,
        vehicleModels,
      };
    }
    return result;
  }

  private buildJC1Schema(pdcList: RawPdcData[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const pdc of pdcList) {
      const pdcName = pdc.id.trim();
      const vehicleModels: Record<string, any> = {};
      for (const vehicle of pdc.vehicles) {
        const vehicleName = this.extractVehicleName(vehicle);
        const kfMap: Record<string, string> = {};
        const codeObj = vehicle.productData || vehicle.code;

        if (codeObj && typeof codeObj === 'object' && !Array.isArray(codeObj)) {
          for (const [key, val] of Object.entries(codeObj)) {
            kfMap[key] = String(val);
          }
        } else if (Array.isArray(codeObj)) {
          codeObj.forEach((val, idx) => {
            kfMap[`code_${idx + 1}`] = String(val);
          });
        } else if (codeObj !== undefined && codeObj !== null) {
          kfMap['code'] = String(codeObj);
        }

        vehicleModels[vehicleName] = kfMap;
      }
      result[pdcName] = {
        batchNumber: pdc.batchNumber,
        warehouseCode: pdc.warehouseCode,
        vehicleModels,
      };
    }
    return result;
  }

  private buildJC2Schema(pdcList: RawPdcData[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const pdc of pdcList) {
      const pdcName = pdc.id.trim();
      const vehicleModels: Record<string, any> = {};
      for (const vehicle of pdc.vehicles) {
        const vehicleName = this.extractVehicleName(vehicle);
        const describe = this.extractDescribe(vehicle);
        let codeArray: string[] = [];
        const codeObj = vehicle.code || vehicle.productData;

        if (Array.isArray(codeObj)) {
          codeArray = codeObj.map((c) => String(c));
        } else if (codeObj && typeof codeObj === 'object') {
          codeArray = Object.values(codeObj).map((c) => String(c));
        } else if (codeObj !== undefined && codeObj !== null) {
          codeArray = [String(codeObj)];
        }

        vehicleModels[vehicleName] = {
          describe,
          code: codeArray,
        };
      }
      result[pdcName] = {
        batchNumber: pdc.batchNumber,
        warehouseCode: pdc.warehouseCode,
        vehicleModels,
      };
    }
    return result;
  }

  private buildFinishingSchema(pdcList: RawPdcData[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const pdc of pdcList) {
      const pdcName = pdc.id.trim();
      const vehicleModels: Record<string, any> = {};
      for (const vehicle of pdc.vehicles) {
        const vehicleName = this.extractVehicleName(vehicle);
        const modelData: Record<string, any> = {};
        const codeObj = vehicle.code || vehicle.productData;

        if (codeObj && typeof codeObj === 'object' && !Array.isArray(codeObj)) {
          for (const [key, val] of Object.entries(codeObj)) {
            if (Array.isArray(val)) {
              modelData[key] = val.map((item) => String(item));
            } else {
              modelData[key] = String(val);
            }
          }
        } else if (Array.isArray(codeObj)) {
          modelData['code'] = codeObj.map((c) => String(c));
        } else if (codeObj !== undefined && codeObj !== null) {
          modelData['code'] = String(codeObj);
        }

        vehicleModels[vehicleName] = modelData;
      }
      result[pdcName] = {
        batchNumber: pdc.batchNumber,
        warehouseCode: pdc.warehouseCode,
        vehicleModels,
      };
    }
    return result;
  }

  private buildFinishingSetSchema(pdcList: RawPdcData[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const pdc of pdcList) {
      const pdcName = pdc.id.trim();
      const vehicleModels: Record<string, any> = {};
      for (const vehicle of pdc.vehicles) {
        const vehicleName = this.extractVehicleName(vehicle);
        const describe = this.extractDescribe(vehicle);
        let code = '';
        const codeObj = vehicle.code || vehicle.productData;

        if (codeObj && typeof codeObj === 'object' && !Array.isArray(codeObj)) {
          const entries = Object.entries(codeObj);
          if (entries.length > 0) {
            code = String(entries[0][1]);
          }
        } else if (Array.isArray(codeObj)) {
          code = String(codeObj[0] || '');
        } else if (codeObj !== undefined && codeObj !== null) {
          code = String(codeObj);
        }

        vehicleModels[vehicleName] = {
          describe,
          code,
        };
      }
      result[pdcName] = {
        batchNumber: pdc.batchNumber,
        warehouseCode: pdc.warehouseCode,
        vehicleModels,
      };
    }
    return result;
  }
}

export default SchemaGeneratorService.getInstance();
