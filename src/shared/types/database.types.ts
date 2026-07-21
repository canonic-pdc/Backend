/**
 * Firestore Database Schema Interfaces for Canonic Backend
 * 
 * This file defines the TypeScript interfaces for all Firestore root collections
 * and their subcollections used in the Canonic application.
 */

/**
 * Represents a Firebase Firestore Timestamp structure.
 */
export interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

/**
 * Union type for date fields in Firestore, which can be retrieved as a 
 * Timestamp object, Date object, or ISO string.
 */
export type SchemaTimestamp = FirestoreTimestamp | Date | string;

// ==========================================
// 1. JOB COSTING 1 (LEMBARAN) COLLECTION
// ==========================================

/**
 * Root Document for Job Costing 1
 * Collection Path: `/Job Costing 1/{pdcId}`
 * 
 * Document ID: Sanitized uppercase PDC Name.
 */
export interface JobCosting1Document {
  /** The unique PDC name (sanitized, e.g., "AION") */
  id: string;
  
  /** Nomor batch job costing untuk kategori lembaran. */
  batchNumber: string;
  
  /** Kode gudang penyimpanan untuk pemetaan inventory. */
  kodeGudang: string;
  
  /** Timestamp when this document was created */
  createdAt: SchemaTimestamp;
  
  /** Timestamp of the last update to this document */
  updatedAt: SchemaTimestamp;
}

/**
 * Job Costing 1 Vehicles Subcollection
 * Collection Path: `/Job Costing 1/{pdcId}/vehicles/{vehicleId}`
 * 
 * Document ID: Name/Type/Variant of the vehicle.
 */
export interface JobCosting1Vehicle {
  /** Name or variant ID of the vehicle (e.g. "AION UT") */
  id: string;
  
  /** Keterangan/deskripsi status pengerjaan atau keterangan batch. */
  describe: string;
  
  /**
   * Pemetaan detail nama bagian/kaca film ke kode produk lembaran yang digunakan.
   */
  productData: Record<string, string>;
  
  /** Optional timestamp of the last update */
  updatedAt?: SchemaTimestamp;
  
  /** Identitas user yang melakukan pembaruan terakhir (audit log) */
  updatedBy?: string;
}

// ==========================================
// 2. JOB COSTING 2 (KACA SET) COLLECTION
// ==========================================

/**
 * Root Document for Job Costing 2
 * Collection Path: `/Job Costing 2/{pdcId}`
 * 
 * Document ID: Sanitized uppercase PDC Name.
 */
export interface JobCosting2Document {
  /** The unique PDC name (sanitized, e.g., "AION") */
  id: string;
  
  /** Nomor batch job costing untuk kategori kaca set. */
  batchNumber: string;
  
  /** Kode gudang penyimpanan kaca set. */
  kodeGudang: string;
  
  /** Timestamp when this document was created */
  createdAt: SchemaTimestamp;
  
  /** Timestamp of the last update to this document */
  updatedAt: SchemaTimestamp;
}

/**
 * Job Costing 2 Vehicles Subcollection
 * Collection Path: `/Job Costing 2/{pdcId}/vehicles/{vehicleId}`
 * 
 * Document ID: Name/Type/Variant of the vehicle.
 */
export interface JobCosting2Vehicle {
  /** Name or variant ID of the vehicle (e.g. "AION UT") */
  id: string;
  
  /** Keterangan/deskripsi status set. */
  describe: string;
  
  /** Daftar kode lembaran kaca film yang membentuk satu set kendaraan utuh. */
  code: string[];
  
  /** Optional timestamp of the last update */
  updatedAt?: SchemaTimestamp;
  
  /** Identitas user yang melakukan pembaruan terakhir (audit log) */
  updatedBy?: string;
}

// ==========================================
// 3. DO (DELIVERY ORDER / VERIFIKASI) COLLECTION
// ==========================================

/**
 * Root Document for DO (Delivery Order)
 * Collection Path: `/DO/{pdcId}`
 * 
 * Document ID: Sanitized uppercase PDC Name.
 */
export interface DODocument {
  /** The unique PDC name (sanitized, e.g., "AION") */
  id: string;
  
  /** Nomor batch DO (Delivery Order). */
  batchNumber: string;
  
  /** Kode gudang penyimpanan untuk status pemasangan. */
  kodeGudang: string;
  
  /** Timestamp when this document was created */
  createdAt: SchemaTimestamp;
  
  /** Timestamp of the last update to this document */
  updatedAt: SchemaTimestamp;
}

/**
 * DO Vehicles Subcollection
 * Collection Path: `/DO/{pdcId}/vehicles/{vehicleId}`
 * 
 * Document ID: Name/Type/Variant of the vehicle.
 */
export interface DOVehicle {
  /** Name or variant ID of the vehicle (e.g. "AION UT") */
  id: string;
  
  /** Deskripsi verifikasi pemasangan. */
  describe: string;
  
  /** Berisi kode identitas integrasi internal (seperti IMI atau PDSO). */
  productData: Record<string, string>;
  
  /** Optional timestamp of the last update */
  updatedAt?: SchemaTimestamp;
  
  /** Identitas user yang melakukan pembaruan terakhir (audit log) */
  updatedBy?: string;
}

// ==========================================
// COMMON DETAIL LIST SUBCOLLECTION
// ==========================================

/**
 * Detail List Subcollection
 * Collection Path: `/{Job Costing 1 | Job Costing 2 | DO}/{pdcId}/detail_list/{detailId}`
 */
export interface DetailListItem {
  /** Dynamic document ID */
  id: string;
  
  /** Nama mobil yang diproses */
  mobilName?: string;
  
  /** Lokasi pengerjaan / PDC */
  lokasi?: string;
  
  /** Batch nomor job costing / DO */
  batch?: string;
  
  /** Kode gudang yang diset */
  warehouseCode?: string;
  
  /** Tipe job costing ("Job Costing 1", "Job Costing 2", "DO") */
  jobCostingType?: string;
  
  /** Deskripsi item */
  describe?: string;
  
  /** Additional dynamic fields based on Excel rows */
  [key: string]: unknown;
}

// ==========================================
// 4. ORDINANCE (SUBSTITUSI) COLLECTION
// ==========================================

/**
 * Root Document for Ordinance (Substitusi Kaca Film)
 * Collection Path: `/Ordinance/{ordinanceId}`
 */
export interface OrdinanceDocument {
  /** The document ID (same as title usually) */
  id: string;
  
  /** Judul aturan / Keterangan kaca film */
  title: string;
  
  /** Kode produk utama/standar yang ingin disubstitusi */
  mainCode: string;
  
  /** Daftar kode produk alternatif yang diizinkan untuk menggantikan kode utama */
  subCodes: string[];
  
  /** Status regulasi: "tambah" atau "ganti" */
  status: "tambah" | "ganti";
  
  /** Timestamp when the rule was created */
  createdAt: SchemaTimestamp;
  
  /** Timestamp of the last update to this rule */
  updatedAt: SchemaTimestamp;
  
  /** Identitas user yang melakukan pembaruan terakhir (audit log) */
  updatedBy?: string;
}

// ==========================================
// UNIFIED TYPES & METADATA
// ==========================================

export type UserRole = 'admin' | 'editor' | 'viewer';

/**
 * Tambahan interface pada dokumen pengguna (User Document) untuk keperluan otomatisasi CLI
 */
export interface UserAutomationMetadata {
  automationKeyHash: string | null; // SHA-256 hash dari API Key rahasia (Wajib Single Index)
  automationKeyPrefix: string | null; // 8 karakter awal untuk UI (misal: "cnk_live_a1b2...")
  automationKeyStatus: 'active' | 'revoked' | 'suspended' | null;
  registeredDeviceId: string | null; // Hardware ID (Machine ID) komputer terikat
  registeredDeviceName: string | null; // Hostname/OS komputer terikat (misal: "DESKTOP-RYAN-PC")
  automationLastUsedAt: string | null; // ISO Timestamp terakhir kali digunakan via CLI
  automationLastUsedIp: string | null; // IP Address terakhir pemanggil CLI
}

/**
 * Root Document for Users
 * Collection Path: `/users/{uid}`
 */
export interface UserDocument extends UserAutomationMetadata {
  /** The unique Firebase Auth UID of the user */
  id: string;
  
  /** User's email address */
  email: string;
  
  /** User's display name */
  name: string;
  
  /** User's role for access control */
  role: UserRole;
  
  /** Timestamp when the user profile was created */
  createdAt: SchemaTimestamp;
  
  /** Timestamp of the last update to this user profile */
  updatedAt: SchemaTimestamp;
}

/**
 * Entry metadata untuk tracking versi skema per modul
 */
export interface SchemaMetaEntry {
  version: number;
  updatedAt: SchemaTimestamp;
}

/**
 * Dokumen metadata untuk pengecekan versi skema
 * Collection Path: `/system/schema_meta`
 */
export interface SchemaMetaDocument {
  DO?: SchemaMetaEntry;
  JC1?: SchemaMetaEntry;
  JC2?: SchemaMetaEntry;
  Finishing?: SchemaMetaEntry;
  FinishingSet?: SchemaMetaEntry;
  Ordinance?: SchemaMetaEntry;
  [key: string]: SchemaMetaEntry | undefined;
}

export type RootCollectionName = "Job Costing 1" | "Job Costing 2" | "DO" | "Finishing" | "FinishingSet" | "Ordinance" | "users" | "system";
export type SubcollectionName = "vehicles" | "detail_list";

