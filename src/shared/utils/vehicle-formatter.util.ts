/**
 * Utility class to format vehicle payload shapes consistently across routes.
 */
export class VehicleFormatter {
  /**
   * Formats a raw vehicle payload based on the target collection rules.
   * @param collectionName The root collection name (e.g., Job Costing 1)
   * @param vehicle Raw vehicle payload from request body
   * @param now Current timestamp in ISO format
   * @param creatorEmail User email who performed the action
   * @returns Formatted vehicle object
   */
  public static format(collectionName: string, vehicle: any, now: string, creatorEmail: string): any {
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
    return vehicleData;
  }
}
