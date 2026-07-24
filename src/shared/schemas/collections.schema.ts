import { z } from 'zod';

export const vehicleSchema = z.object({
  name: z.string().optional(),
  vehicleName: z.string().optional(),
  describe: z.string().optional(),
  productData: z.record(z.string(), z.any()).optional(),
  code: z.array(z.string()).optional(),
}).passthrough();

export const createPdcSchema = z.object({
  body: z.object({
    pdcName: z.string().min(1, 'pdcName is required'),
    batchNumber: z.string().optional(),
    kodeGudang: z.string().optional(),
    vehicles: z.array(vehicleSchema).optional(),
  }).passthrough(),
  query: z.any().optional(),
  params: z.any().optional(),
});

export const updatePdcSchema = z.object({
  body: z.object({
    batchNumber: z.string().optional(),
    kodeGudang: z.string().optional(),
    vehicles: z.array(vehicleSchema).optional(),
  }).passthrough(),
  query: z.any().optional(),
  params: z.any().optional(),
});
