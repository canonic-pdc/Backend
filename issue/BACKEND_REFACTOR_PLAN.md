# Rencana Refaktorisasi & Pengembangan `Backend` (Node.js/Express + Vercel Serverless)

**Acuan Utama:** [AUTOMATION_INTEGRATION_AND_SECURITY_PLAN.md](file:///d:/RYAN-OPR/DEVELOP/canonic/AUTOMATION_INTEGRATION_AND_SECURITY_PLAN.md) (v2.0.0)  
**Target Direktori:** `d:\RYAN-OPR\DEVELOP\canonic\Backend`  
**Tujuan:** Mengimplementasikan penyediaan skema dinamis secara _on-demand_ dalam format **JSON Murni (Pure JSON Object)**, autentikasi CLI berbasis hash di koleksi `users`, proteksi penguncian perangkat (`1 Key = 1 Device Binding`), dan mekanisme _check-version_ hemat biaya untuk Vercel Serverless.

---

## 1. Perbaikan Skema & Index Firestore

### A. Pengayaan Koleksi `users` (`/users/{uid}`)

Struktur dokumen pengguna di `/users/{uid}` akan diperluas untuk menampung kredensial dan metadata penguncian perangkat CLI:

```typescript
// Tambahan interface pada dokumen pengguna (User Document)
export interface UserAutomationMetadata {
  automationKeyHash: string | null; // SHA-256 hash dari API Key rahasia (Wajib Single Index)
  automationKeyPrefix: string | null; // 8 karakter awal untuk UI (misal: "cnk_live_a1b2...")
  automationKeyStatus: "active" | "revoked" | "suspended";
  registeredDeviceId: string | null; // Hardware ID (Machine ID) komputer terikat
  registeredDeviceName: string | null; // Hostname/OS komputer terikat (misal: "DESKTOP-RYAN-PC")
  automationLastUsedAt: string | null; // ISO Timestamp terakhir kali digunakan via CLI
  automationLastUsedIp: string | null; // IP Address terakhir pemanggil CLI
}
```

> [!IMPORTANT]
> **Kebutuhan Index Firestore:**  
> Wajib membuat **Single Index / Unique Lookup Index** untuk field `automationKeyHash` pada koleksi `users` agar query verifikasi middleware berjalan seketika dengan `limit(1)`.

### B. Inisialisasi Dokumen Metadata (`/system/schema_meta`)

Dokumen ini bertugas melacak versi skema setiap modul sehingga CLI dapat melakukan pengecekan `HTTP 304 Not Modified` hanya dengan 1 kali pembacaan dokumen.

- **Path Dokumen:** `/system/schema_meta`
- **Struktur Inisial JSON:**
  ```json
  {
    "DO": { "version": 1, "updatedAt": "2026-07-17T00:00:00Z" },
    "JC1": { "version": 1, "updatedAt": "2026-07-17T00:00:00Z" },
    "JC2": { "version": 1, "updatedAt": "2026-07-17T00:00:00Z" },
    "Finishing": { "version": 1, "updatedAt": "2026-07-17T00:00:00Z" },
    "FinishingSet": { "version": 1, "updatedAt": "2026-07-17T00:00:00Z" }
  }
  ```

---

## 2. Struktur Modul Baru (`src/features/automation/`)

Seluruh kode backend untuk otomatisasi akan diorganisasikan dalam satu fitur modular:

```text
Backend/src/features/automation/
├── controllers/
│   └── automation.controller.ts        # Controller untuk endpoint otentikasi key & schema checks
├── middlewares/
│   └── authAutomation.middleware.ts    # Middleware proteksi Bearer Token hash & Device ID Binding
├── services/
│   ├── apiKey.service.ts               # Service generator key, hashing SHA-256, & reset binding
│   └── schemaGenerator.service.ts      # Service On-Demand pengolah data ke format JSON Murni
├── types/
│   └── automation.types.ts             # DTO dan Interface request/response otomatisasi
└── routes/
    └── automation.routes.ts            # Definisi rute REST API automation v1
```

---

## 3. Spesifikasi Detail Implementasi

### A. Middleware `authAutomation.middleware.ts`

Middleware ini memproteksi rute `/api/v1/automation/schema/*` dari akses ilegal atau penyebaran kunci antar komputer.

**Alur Kerja Logika Middleware:**

1. Ekstraksi header `Authorization: Bearer <API_KEY>` dan `X-Device-ID: <HARDWARE_ID>`.
2. Jika header tidak lengkap, kembalikan `401 Unauthorized` atau `400 Bad Request`.
3. Hitung SHA-256 hash dari `<API_KEY>` yang dikirim.
4. Lakukan pencarian ke Firestore:
   ```typescript
   const userQuery = await firestore
     .collection("users")
     .where("automationKeyHash", "==", hashedKey)
     .limit(1)
     .get();
   ```
5. Jika tidak ditemukan atau `automationKeyStatus !== 'active'`, kembalikan `401 Unauthorized`.
6. Validasi Role: Pastikan `user.role` termasuk dalam `['admin', 'editor']`.
7. **Logika Auto-Binding / Device Check:**
   - **Skenario Penggunaan Pertama (`registeredDeviceId === null`):**
     Lakukan update dokumen `users/{user.id}` dengan `registeredDeviceId = req.headers['x-device-id']` dan `registeredDeviceName = req.headers['x-device-name'] || 'Unknown PC'`.
   - **Skenario Perangkat Sah (`registeredDeviceId === req.headers['x-device-id']`):**
     Lanjutkan ke _next handler_ dan perbarui `automationLastUsedAt` (secara _asynchronous background update_ agar tidak menambah latensi).
   - **Skenario Perangkat Ditolak (`registeredDeviceId !== req.headers['x-device-id']`):**
     Lempar `403 Forbidden` dengan pesan error eksplisit: `DEVICE_MISMATCH: API Key telah terikat pada perangkat lain. Hubungi Admin untuk reset device binding.`
8. Sisipkan objek user ke `req.automationUser` lalu panggil `next()`.

---

### B. Service `schemaGenerator.service.ts` (On-Demand JSON Transformation)

Service ini mereplikasi logika transformasi skema dari `Frontend/src/services/export/dataParser.ts`. Service **TIDAK membaca dari koleksi duplikat (`automation_schemas`)** dan **TIDAK menghasilkan string kode TypeScript (`.ts`)**. Service ini membaca langsung dari koleksi sumber asli secara _lazy/on-demand_ dan mengembalikannya sebagai **JSON Object Murni**:

- **Saat dipanggil dengan `type = 'DO'`:**
  Mengambil dokumen dari koleksi root `DO`, melakukan transformasi struktur pengelompokan berdasarkan _PDC (Pre-Delivery Check)_ dan _Vehicle_, lalu menghasilkan objek JSON berformat `ProductCodeDO` (dengan struktur tepat sama seperti `productCodesDOConst`).
- **Saat dipanggil dengan `type = 'JC1' | 'JC2'`:**
  Mengambil dokumen dari koleksi root `Job Costing 1` atau `Job Costing 2`, mengelompokkan kode barang, harga, dan formula, lalu menghasilkan objek JSON berformat `ProductCodeJC1` / `ProductCodeJC2`.
- **Keuntungan Format JSON Murni untuk Vercel Serverless:**
  Eksekusi serialisasi JSON (`res.json(data)`) memakan waktu `< 1 ms` di V8 Node.js, menjaga _function duration_ Vercel tetap di angka minimum (`~15-50 ms`).

```typescript
export class SchemaGeneratorService {
  async getFormattedSchema(
    type: "DO" | "JC1" | "JC2" | "Finishing" | "FinishingSet",
  ): Promise<Record<string, any>> {
    switch (type) {
      case "DO":
        return await this.buildDOSchema();
      case "JC1":
        return await this.buildJC1Schema();
      case "JC2":
        return await this.buildJC2Schema();
      case "Finishing":
        return await this.buildFinishingSchema();
      case "FinishingSet":
        return await this.buildFinishingSetSchema();
      default:
        throw new Error(`Unsupported schema type: ${type}`);
    }
  }

  private async buildDOSchema(): Promise<Record<string, any>> {
    const snapshot = await firestore.collection("DO").get();
    // Logika parsing/transform sequence menyerupai dataParser.ts di frontend
    // Return objek JSON matang (bukan string TypeScript!)
  }
}
```

---

### C. Service `apiKey.service.ts`

Bertanggung jawab atas siklus hidup kunci otorisasi:

- **`generateOrRegenerateKey(userId: string)`**:
  Menghasilkan string acak seaman mungkin (`cnk_live_` + 48 hex random characters), menghitung SHA-256 hash, menghapus binding perangkat lama (`registeredDeviceId = null`), dan menyimpan hash ke dokumen `/users/{userId}`. Mengembalikan plain key hanya 1x.
- **`resetDeviceBinding(targetUserId: string)` _(Admin Only)_**:
  Mengubah `registeredDeviceId` dan `registeredDeviceName` menjadi `null` pada dokumen `/users/{targetUserId}` tanpa merubah API Key.

---

### D. Controller `automation.controller.ts` & Kontrak REST API

#### 1. `GET /api/v1/automation/schema/check-version`

- **Proteksi:** Middleware `authAutomation.middleware.ts`
- **Query Params:** `type=DO|JC1|JC2|Finishing|FinishingSet` & `localVersion=<NUMBER>`
- **Alur Logika:**
  1. Baca dokumen `/system/schema_meta` dari Firestore (Hanya 1 read).
  2. Bandingkan angka versi `schema_meta[type].version` dengan `Number(req.query.localVersion)`.
  3. **Jika Versi Sama (`serverVersion === localVersion`):**
     Set header `Cache-Control: s-maxage=300, stale-while-revalidate=3600` dan kembalikan status `HTTP 304 Not Modified` tanpa payload tubuh.
  4. **Jika Versi Berbeda / Cache Lokal Kosong (`serverVersion !== localVersion`):**
     Panggil `SchemaGeneratorService.getFormattedSchema(type)`.
     Set header `Cache-Control: s-maxage=300, stale-while-revalidate=3600` dan kembalikan status `HTTP 200 OK` berserta JSON skema terbaru:
     ```json
     {
       "success": true,
       "type": "DO",
       "version": 15,
       "fetchedAt": "2026-07-17T14:00:00.000Z",
       "data": {
         "AION": {
           "batchNumber": "DO 38",
           "warehouseCode": "AION PASANG",
           "vehicleModels": {
             "AION UT": {
               "describe": "VERIFIKASI AION UT LLUMAR + FD  EY 20",
               "code": "AION-VUT+FD20",
               "client": "IMI"
             }
           }
         }
       }
     }
     ```

#### 2. `POST /api/v1/automation/keys`

- **Proteksi:** Firebase ID Token Auth (`req.user` dari web frontend)
- **Body:** Kosong (atau `{ action: 'regenerate' }`)
- **Alur Logika:** Memanggil `apiKeyService.generateOrRegenerateKey(req.user.uid)` dan mengembalikan response `{ success: true, plainKey: "cnk_live_..." }`.

#### 3. `POST /api/v1/automation/users/:userId/reset-device` _(Admin Only)_

- **Proteksi:** Firebase ID Token Auth + Admin Role Check (`requireRole('admin')`)
- **Params:** `userId` (ID karyawan/target user)
- **Alur Logika:** Memanggil `apiKeyService.resetDeviceBinding(req.params.userId)` dan mengembalikan `{ success: true, message: "Device binding reset successfully." }`.

---

## 4. Checklist Eksekusi Backend (`TODO Tracker`)

- [ ] **Setup Index & Metadata Inisial:**
  - [ ] Tambahkan konfigurasi index tunggal `automationKeyHash` di Firebase Console atau `firestore.indexes.json`.
  - [ ] Buat script inisialisasi untuk membuat dokumen `/system/schema_meta` di Firestore jika belum ada.
- [ ] **Pembuatan Fitur `src/features/automation/`:**
  - [ ] Buat definisi tipe/DTO di `types/automation.types.ts`.
  - [ ] Implementasikan `services/apiKey.service.ts` (generator key, SHA-256 hash, reset binding).
  - [ ] Implementasikan `services/schemaGenerator.service.ts` dengan menyalin alur transformasi dari frontend `dataParser.ts` ke format JSON murni.
  - [ ] Implementasikan `middlewares/authAutomation.middleware.ts` (verifikasi Bearer hash, auto-binding Device ID, penanganan 403 Device Mismatch).
  - [ ] Implementasikan `controllers/automation.controller.ts` untuk menangani logika `304 Not Modified` dan `200 OK` dengan CDN header.
  - [ ] Daftarkan rute di `routes/automation.routes.ts` dan hubungkan ke router utama API v1 (`src/routes/v1/index.ts`).
- [ ] **Pengujian & Validasi:**
  - [ ] Uji pemanggilan `check-version` dengan versi lokal yang sama -> pastikan balasan `304 Not Modified`.
  - [ ] Uji pemanggilan dengan versi berbeda -> pastikan balasan `200 OK` berserta payload JSON matang.
  - [ ] Uji simulasi penyalahgunaan key dengan `X-Device-ID` berbeda -> pastikan balasan `403 Forbidden: DEVICE_MISMATCH`.
