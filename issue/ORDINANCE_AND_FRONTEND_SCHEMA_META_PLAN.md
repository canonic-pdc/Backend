# Rencana Implementasi: Pelacakan Versi Skema `Ordinance` & Endpoint `schema_meta` untuk Frontend Web

**Status:** Proposed / Ready for Implementation  
**Tanggal:** 21 Juli 2026  
**Target Direktori:** `src/features/automation`, `src/routes/v1`, `src/scripts`, dan `doc/`  

---

## 📋 Latar Belakang & Tujuan Arsitektur

Saat ini sistem memiliki mekanisme pelacakan versi skema data (`/system/schema_meta`) untuk otomatisasi CLI (`check-version`). Namun, terdapat 2 celah kebutuhan yang perlu disempurnakan:
1. **Pelacakan Versi untuk `Ordinance` (SOP)**: Data aturan pemasangan/SOP sangat penting dan sering mengalami penambahan atau revisi. Saat ini `Ordinance` belum terhubung dengan `SchemaMetaService`, sehingga perubahan data SOP tidak memicu peningkatan nomor versi (`auto-increment`).
2. **Keterbatasan Akses untuk Frontend Web (`React + TypeScript`)**: Endpoint `GET /api/v1/automation/schema/check-version` dilindungi oleh `authAutomationMiddleware` yang mewajibkan header `X-Device-ID` dan `Authorization: Bearer <API_KEY_CLI>`. Aplikasi Web React yang login menggunakan Firebase ID Token (`requireAuth`) tidak dapat mengakses endpoint CLI tersebut, sehingga membutuhkan **endpoint khusus yang ringan dan aman bagi web frontend** untuk memeriksa nomor versi data koleksi terkini (`stale-check / cache invalidation`).

---

## 🎯 Poin-Poin Implementasi (Technical Specification)

### Phase 1: Pembaruan Kontrak Tipe & Skema Dasar (`Shared & Automation Types`)
1. **Pembaruan Tipe (`src/shared/types/database.types.ts`)**:
   - Tambahkan properti `Ordinance?: SchemaMetaEntry;` pada interface `SchemaMetaDocument`.
2. **Pembaruan Tipe (`src/features/automation/types/automation.types.ts`)**:
   - Tambahkan `'Ordinance'` ke dalam union type `AutomationSchemaType`:
     ```typescript
     export type AutomationSchemaType = 'DO' | 'JC1' | 'JC2' | 'Finishing' | 'FinishingSet' | 'Ordinance';
     ```
3. **Pembaruan Script Inisialisasi (`src/scripts/init-schema-meta.ts`)**:
   - Tambahkan nilai default `Ordinance: { version: 1, updatedAt: now }` ke dalam objek `initialData`.

---

### Phase 2: Auto-Increment Trigger untuk `Ordinance` (`SchemaMetaService` & `ordinance.routes.ts`)
1. **Registrasi Key di `SchemaMetaService` (`src/features/automation/services/schemaMeta.service.ts`)**:
   - Pada metode `getSchemaKey(colNameOrType: string)`, tambahkan pemetaan:
     ```typescript
     case 'Ordinance':
     case 'ordinance':
       return 'Ordinance';
     ```
2. **Pemasangan Trigger di Rute Ordinance (`src/routes/v1/ordinance.routes.ts`)**:
   - Import `schemaMetaService` dari `@features/automation/services/schemaMeta.service`.
   - Sisipkan pemanggilan `await schemaMetaService.incrementVersion('Ordinance');` setelah operasi Firestore berhasil pada:
     - `POST /api/v1/ordinance` (Pembuatan aturan baru)
     - `PUT /api/v1/ordinance/:id` (Pembaruan/revisi aturan)
     - `DELETE /api/v1/ordinance/:id` (Penghapusan aturan)

---

### Phase 3: Dukungan JSON Schema `Ordinance` untuk CLI (`SchemaGeneratorService`)
1. **Pembaruan `VALID_SCHEMA_TYPES` (`src/features/automation/controllers/automation.controller.ts`)**:
   - Tambahkan `'Ordinance'` ke dalam array `VALID_SCHEMA_TYPES` agar query `?type=Ordinance` diterima oleh endpoint `/api/v1/automation/schema/check-version`.
2. **Implementasi `buildOrdinanceSchema` (`src/features/automation/services/schemaGenerator.service.ts`)**:
   - Tambahkan case `'Ordinance'` pada `getFormattedSchema(type)`.
   - Buat metode private `buildOrdinanceSchema(pdcList: any[])` (atau metode khusus yang mengambil dari koleksi `Ordinance`) untuk mengembalikan struktur JSON murni yang teroptimasi bagi script CLI:
     ```json
     {
       "ATURAN_KACA_01": {
         "title": "Aturan Pemasangan Kaca Depan",
         "mainCode": "KACA_01",
         "subCodes": ["SEALANT_A", "PRIMER_B"],
         "status": "tambah"
       }
     }
     ```

---

### Phase 4: Pembuatan Endpoint Khusus Frontend Web (`GET /api/v1/system/schema-meta/versions`)
Membuat endpoint REST API baru yang ramah untuk web browser (tanpa perlu `X-Device-ID`).

1. **Definisi Endpoint Baru (`src/routes/v1/system.routes.ts`)**:
   - **Rute:** `GET /api/v1/system/schema-meta/versions`
   - **Akses:** Private (`requireAuth`) atau Public Cached (`Cache-Control: public, max-age=15, stale-while-revalidate=60`).
   - **Tujuan:** Mengembalikan dictionary ringkas nomor versi untuk seluruh koleksi (termasuk `Ordinance`) sehingga Frontend React dapat membandingkan dengan state lokal di browser/Redux/Zustand dan menentukan apakah perlu memuat ulang data dari server.
2. **Contoh Payload Response (`200 OK`)**:
   ```json
   {
     "success": true,
     "message": "Schema metadata versions retrieved successfully.",
     "data": {
       "DO": { "version": 4, "updatedAt": "2026-07-21T08:00:00.000Z" },
       "JC1": { "version": 12, "updatedAt": "2026-07-21T08:10:00.000Z" },
       "JC2": { "version": 3, "updatedAt": "2026-07-21T07:30:00.000Z" },
       "Finishing": { "version": 1, "updatedAt": "2026-07-20T12:00:00.000Z" },
       "FinishingSet": { "version": 2, "updatedAt": "2026-07-20T15:00:00.000Z" },
       "Ordinance": { "version": 5, "updatedAt": "2026-07-21T08:25:00.000Z" }
     }
   }
   ```

---

### Phase 5: Pembaruan Dokumentasi (`doc/API_CONTRACT.md`)
1. Cantumkan rute baru `GET /api/v1/system/schema-meta/versions` pada bagian **Health & System Operations**.
2. Perbarui dokumentasi `GET /api/v1/automation/schema/check-version` bahwa parameter query `type` sekarang mendukung `Ordinance`.

---

## 🛠️ Ringkasan File yang Akan Dimodifikasi / Dibuat

| Status | File Path | Deskripsi Perubahan |
| :---: | :--- | :--- |
| **[MODIFY]** | `src/shared/types/database.types.ts` | Tambahkan properti `Ordinance?` pada `SchemaMetaDocument`. |
| **[MODIFY]** | `src/features/automation/types/automation.types.ts` | Tambahkan `'Ordinance'` pada union type `AutomationSchemaType`. |
| **[MODIFY]** | `src/scripts/init-schema-meta.ts` | Tambahkan inisialisasi default versi untuk `Ordinance`. |
| **[MODIFY]** | `src/features/automation/services/schemaMeta.service.ts` | Daftarkan `getSchemaKey('Ordinance')`. |
| **[MODIFY]** | `src/routes/v1/ordinance.routes.ts` | Pasang trigger `schemaMetaService.incrementVersion('Ordinance')` di `POST`, `PUT`, `DELETE`. |
| **[MODIFY]** | `src/features/automation/controllers/automation.controller.ts` | Tambahkan `'Ordinance'` ke `VALID_SCHEMA_TYPES`. |
| **[MODIFY]** | `src/features/automation/services/schemaGenerator.service.ts` | Implementasikan pembuatan format JSON murni `buildOrdinanceSchema()`. |
| **[MODIFY]** | `src/routes/v1/system.routes.ts` | Tambahkan endpoint baru `GET /schema-meta/versions` untuk Frontend Web. |
| **[MODIFY]** | `doc/API_CONTRACT.md` | Perbarui kontrak API sesuai fitur baru. |
