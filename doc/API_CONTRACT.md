# Canonic Backend API Contract Documentation

**Version:** 1.0.0  
**Base URL:** `/api/v1`  
**Protocol:** HTTPS / REST  
**Data Format:** JSON (`application/json`)  

---

## 📌 1. General Conventions & Authentication

### 1.1 Response Formatter (Standard JSON Envelope)
All API endpoints return JSON payloads wrapped inside a standardized envelope produced by `ResponseFormatter`.

#### ✅ Success Response (`200 OK`, `201 Created`)
```json
{
  "success": true,
  "message": "Human readable summary of the operation.",
  "data": { ... } // or [ ... ] or null
}
```

#### ❌ Error Response (`400`, `401`, `403`, `404`, `409`, `500`)
```json
{
  "success": false,
  "message": "Specific description of what went wrong or why validation failed.",
  "status": 400
}
```

### 1.2 Authentication Headers

There are two distinct authentication mechanisms supported across `/api/v1`:

1. **Standard User Authentication (`requireAuth` & `requireRoles`)**  
   Used by frontend web clients (`React + TypeScript`). Requires a valid **Firebase Admin / Google OAuth ID Token**.
   ```http
   Authorization: Bearer <FIREBASE_OR_GOOGLE_ID_TOKEN>
   ```

2. **Automation CLI Authentication (`authAutomationMiddleware`)**  
   Used exclusively by local automation device scripts when accessing `/api/v1/automation/schema/check-version`. Requires a hashed **API Key** generated via `/api/v1/automation/keys` alongside strict **Device ID Binding** headers (`1 Key = 1 Device`).
   ```http
   Authorization: Bearer <AUTOMATION_API_KEY>
   X-Device-ID: <UNIQUE_DEVICE_HARDWARE_OR_UUID>
   X-Device-Name: <OPTIONAL_DEVICE_HOSTNAME>
   ```

### 1.3 Target Consumer Matrix & Categorization

To make integration unmistakable for both developers and users, every endpoint in this contract is grouped into one of three distinct consumer categories:

| Consumer Category | Auth Required | Primary Use Cases | Endpoints Included |
| :--- | :--- | :--- | :--- |
| **🌐 Web Frontend (FE)** | `requireAuth`<br>*(Firebase ID Token)* | Interactive web dashboards, user login/session sync, PDC & vehicle CRUD management, RBAC user administration, CLI key generation, reports. | • `/api/v1/auth/me`<br>• `/api/v1/system/info`<br>• `/api/v1/system/schema-meta/versions`<br>• `/api/v1/collections/*` (All CRUD)<br>• `/api/v1/ordinance` (`POST`, `PUT`, `DELETE`)<br>• `/api/v1/automation/keys` (Generate CLI Key)<br>• `/api/v1/automation/users/:id/*`<br>• `/api/v1/users/*` (RBAC Admin)<br>• `/api/v1/vehicles`, `/reconciliation`, `/export/csv` |
| **🤖 Automation CLI** | `authAutomationMiddleware`<br>*(API Key + Device ID)* | Local Python/Node scripts or factory device terminals checking schema versions and downloading dynamic pure JSON datasets (`1 Key = 1 Device`). | • `/api/v1/automation/schema/check-version` |
| **🔄 Mixed / Both** | Public or Cached | General monitoring, server uptime status, and public/read-only retrieval of Ordinance SOP rules. | • `/api/v1/health`<br>• `/api/v1/ordinance` (`GET /` and `GET /:id`) |

---

## 🏥 2. Health & System Operations

### 2.1 Get System Uptime & Health Check
🏷️ **Target Category:** `🔄 Mixed / Both` (Web FE Monitoring & Automation Health Checks)  
Returns the live operational status, node uptime, and active environment.

- **URL:** `/api/v1/health`
- **Method:** `GET`
- **Access:** Public (No Auth Required)
- **Headers Required:** None

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "System is operational.",
  "data": {
    "status": "UP",
    "uptime": 3612.45,
    "environment": "production"
  }
}
```

---

### 2.2 Get Host Node Platform Specifications
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Retrieves platform architecture details of the running server instance.

- **URL:** `/api/v1/system/info`
- **Method:** `GET`
- **Access:** Private (`requireAuth`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "System specifications loaded.",
  "data": {
    "version": "1.0.0",
    "nodeVersion": "v20.12.0",
    "platform": "linux",
    "arch": "x64"
  }
}
```

---

### 2.3 Get All Schema Version Numbers across Collections (Web Frontend)
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Lightweight endpoint specifically tailored for Web Frontend (`React + TypeScript`) dashboards to retrieve the latest version numbers of all collections (`DO`, `JC1`, `JC2`, `Finishing`, `FinishingSet`, and `Ordinance`). Does not require Device ID binding.

- **URL:** `/api/v1/system/schema-meta/versions`
- **Method:** `GET`
- **Access:** Public Cached / Cache-Control enabled (`max-age=15, stale-while-revalidate=60`)
- **Headers Required:** None

#### Response (`200 OK`)
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

## 🔐 3. Authentication & User Profile (`/api/v1/auth`)

### 3.1 Get Current Authenticated Profile
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Retrieves the active user profile and resolved role (`admin`, `editor`, or `viewer`).

- **URL:** `/api/v1/auth/me`
- **Method:** `GET`
- **Access:** Private (`requireAuth`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Authenticated user profile retrieved successfully.",
  "data": {
    "uid": "google_sub_or_firebase_uid_123",
    "email": "user@canonic.com",
    "role": "editor"
  }
}
```

---

## 📦 4. Collections & PDC Management (`/api/v1/collections`)

This domain manages root collections and their nested subcollections (`vehicles` and `detail_list`).  
**Allowed Root Collections:** `DO` | `Job Costing 1` | `Job Costing 2` | `Finishing` | `FinishingSet`

### 4.1 List All PDCs inside a Collection
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Retrieves all PDCs belonging to a root collection, deep-fetching every PDC's subcollections (`vehicles` and `detail_list`) concurrently. Responses are cached in-memory (`TTL: 60s`).

- **URL:** `/api/v1/collections/:collectionName`
- **Method:** `GET`
- **Access:** Public / Cached (No Auth Required)
- **Path Parameters:**
  - `collectionName` (string, required): e.g., `Job Costing 1`
- **Query Parameters:**
  - `limit` (number, optional): Maximum number of PDC documents to return.
  - `page` (number, optional): Page number (`1-indexed`, defaults to `1`).
  - `offset` (number, optional): Exact document offset (overrides `page` if provided).

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Retrieved 2 documents from \"Job Costing 1\".",
  "data": [
    {
      "id": "PDC_BATCH_A_2026",
      "pdcName": "PDC_BATCH_A_2026",
      "batchNumber": "BATCH-001",
      "kodeGudang": "WH-JKT-01",
      "createdAt": "2026-07-21T08:00:00.000Z",
      "updatedAt": "2026-07-21T08:00:00.000Z",
      "createdBy": "admin@canonic.com",
      "vehicles": [
        {
          "id": "TOYOTA_CAMRY_2024",
          "name": "TOYOTA_CAMRY_2024",
          "productData": { "KF1": "CHROME_TRIM", "KF2": "BLACK_LEATHER" },
          "describe": "Luxury sedan finishing specification",
          "updatedAt": "2026-07-21T08:00:00.000Z"
        }
      ],
      "detailList": []
    }
  ]
}
```

---

### 4.2 Get Specific PDC Details
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Retrieves deep details (`root metadata`, `vehicles` subcollection, `detail_list` subcollection) of a single PDC.

- **URL:** `/api/v1/collections/:collectionName/pdc/:pdcName`
- **Method:** `GET`
- **Access:** Public / Cached (No Auth Required)
- **Path Parameters:**
  - `collectionName` (string, required): e.g., `DO`
  - `pdcName` (string, required): e.g., `PDC_BATCH_A_2026`

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Retrieved details for PDC \"PDC_BATCH_A_2026\".",
  "data": {
    "id": "PDC_BATCH_A_2026",
    "pdcName": "PDC_BATCH_A_2026",
    "batchNumber": "BATCH-001",
    "kodeGudang": "WH-JKT-01",
    "vehicles": [ ... ],
    "detailList": [ ... ]
  }
}
```

---

### 4.3 Create New PDC with Optional Vehicles
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Creates a new PDC root document inside the specified collection and inserts any provided vehicle objects into its `vehicles` subcollection. Automatically increments `schema_meta` versioning and invalidates cache.

- **URL:** `/api/v1/collections/:collectionName/pdc`
- **Method:** `POST`
- **Access:** Private (`requireAuth` + `requireRoles(['admin', 'editor'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  Content-Type: application/json
  ```
- **Request Body:**
  ```json
  {
    "pdcName": "PDC_NEW_BATCH_002",
    "batchNumber": "BATCH-002",
    "kodeGudang": "WH-SBY-02",
    "vehicles": [
      {
        "name": "HONDA_CIVIC_RS",
        "describe": "Sport trim specification",
        "productData": {
          "KF1": "RED_ACCENT",
          "KF2": "CARBON_FIBER"
        }
      }
    ]
  }
  ```
  *(Note: For `Job Costing 2`, provide `code` as an array of strings `["CODE_A", "CODE_B"]` or object. For `Finishing`/`FinishingSet`, provide `code` or `productData`.)*

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "Created PDC \"PDC_NEW_BATCH_002\" successfully.",
  "data": {
    "pdcName": "PDC_NEW_BATCH_002",
    "vehiclesCreated": 1
  }
}
```

---

### 4.4 Update PDC Metadata & Upsert Vehicles
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Updates the `batchNumber` or `kodeGudang` of an existing PDC and inserts or overwrites any vehicle entries provided in the `vehicles` array.

- **URL:** `/api/v1/collections/:collectionName/pdc/:pdcName`
- **Method:** `PUT`
- **Access:** Private (`requireAuth` + `requireRoles(['admin', 'editor'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  Content-Type: application/json
  ```
- **Request Body:**
  ```json
  {
    "batchNumber": "BATCH-002-UPDATED",
    "kodeGudang": "WH-SBY-02-REV",
    "vehicles": [
      {
        "name": "HONDA_CIVIC_RS",
        "describe": "Updated description",
        "productData": { "KF1": "GLOSS_BLACK" }
      }
    ]
  }
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Updated PDC \"PDC_NEW_BATCH_002\" successfully.",
  "data": {
    "pdcName": "PDC_NEW_BATCH_002",
    "vehiclesUpdated": 1
  }
}
```

---

### 4.5 Delete Entire PDC & Subcollections
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Recursively deletes all documents inside `vehicles` and `detail_list` subcollections before deleting the parent PDC root document.

- **URL:** `/api/v1/collections/:collectionName/pdc/:pdcName`
- **Method:** `DELETE`
- **Access:** Private (`requireAuth` + `requireRoles(['admin'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Deleted PDC \"PDC_NEW_BATCH_002\" and all its subcollections from \"Job Costing 1\".",
  "data": null
}
```

---

### 4.6 Delete Specific Vehicle inside a PDC
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Deletes a single vehicle document inside the `vehicles` subcollection of a target PDC.

- **URL:** `/api/v1/collections/:collectionName/pdc/:pdcName/vehicles/:vehicleName`
- **Method:** `DELETE`
- **Access:** Private (`requireAuth` + `requireRoles(['admin', 'editor'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Deleted vehicle \"HONDA_CIVIC_RS\" from PDC \"PDC_NEW_BATCH_002\".",
  "data": null
}
```

---

## 📜 5. Ordinance / SOP Rules Management (`/api/v1/ordinance`)

### 5.1 List All Ordinances
🏷️ **Target Category:** `🔄 Mixed / Both` (Web FE & Public Readers)  
Retrieves all SOP rule documents stored under the `Ordinance` collection.

- **URL:** `/api/v1/ordinance`
- **Method:** `GET`
- **Access:** Private (`requireAuth` - or public if called internally/unfiltered)
- **Query Parameters:**
  - `limit`, `page`, `offset` (pagination options)

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Ordinances retrieved successfully.",
  "data": [
    {
      "id": "ATURAN_PEMASANGAN_KACA",
      "title": "Aturan Pemasangan Kaca",
      "mainCode": "KACA_01",
      "subCodes": ["SUB_A1", "SUB_A2"],
      "status": "tambah",
      "createdAt": "2026-07-21T08:00:00.000Z",
      "updatedAt": "2026-07-21T08:00:00.000Z",
      "updatedBy": "editor@canonic.com"
    }
  ]
}
```

---

### 5.2 Get Specific Ordinance by ID
🏷️ **Target Category:** `🔄 Mixed / Both` (Web FE & Public Readers)  
Retrieves details of a single ordinance rule.

- **URL:** `/api/v1/ordinance/:id`
- **Method:** `GET`
- **Access:** Private (`requireAuth`)

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Ordinance retrieved successfully.",
  "data": {
    "id": "ATURAN_PEMASANGAN_KACA",
    "title": "Aturan Pemasangan Kaca",
    "mainCode": "KACA_01",
    "subCodes": ["SUB_A1", "SUB_A2"],
    "status": "tambah",
    "createdAt": "2026-07-21T08:00:00.000Z",
    "updatedAt": "2026-07-21T08:00:00.000Z",
    "updatedBy": "editor@canonic.com"
  }
}
```

---

### 5.3 Create New Ordinance Rule
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Creates a new SOP ordinance document. Document ID is automatically sanitized from `title`.

- **URL:** `/api/v1/ordinance`
- **Method:** `POST`
- **Access:** Private (`requireAuth` + `requireRoles(['admin', 'editor'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  Content-Type: application/json
  ```
- **Request Body:**
  ```json
  {
    "title": "Aturan Pemasangan Kaca Depan",
    "mainCode": "KACA_DEPAN_001",
    "subCodes": ["SEALANT_SILIKON", "PRIMER_A"],
    "status": "tambah" // 'tambah' | 'ganti'
  }
  ```

#### Response (`201 Created`)
```json
{
  "success": true,
  "message": "Ordinance created successfully.",
  "data": {
    "id": "ATURAN_PEMASANGAN_KACA_DEPAN",
    "title": "Aturan Pemasangan Kaca Depan",
    "mainCode": "KACA_DEPAN_001",
    "subCodes": ["SEALANT_SILIKON", "PRIMER_A"],
    "status": "tambah",
    "createdAt": "2026-07-21T08:15:00.000Z",
    "updatedAt": "2026-07-21T08:15:00.000Z",
    "updatedBy": "admin@canonic.com"
  }
}
```

---

### 5.4 Update Ordinance Rule
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Updates specific fields of an existing ordinance document.

- **URL:** `/api/v1/ordinance/:id`
- **Method:** `PUT`
- **Access:** Private (`requireAuth` + `requireRoles(['admin', 'editor'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  Content-Type: application/json
  ```
- **Request Body:** (All fields optional)
  ```json
  {
    "title": "Aturan Pemasangan Kaca Depan (Revisi)",
    "mainCode": "KACA_DEPAN_001_REV",
    "subCodes": ["SEALANT_SILIKON", "PRIMER_A", "CLEANER_B"],
    "status": "ganti"
  }
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Ordinance updated successfully.",
  "data": {
    "id": "ATURAN_PEMASANGAN_KACA_DEPAN",
    "title": "Aturan Pemasangan Kaca Depan (Revisi)",
    "mainCode": "KACA_DEPAN_001_REV",
    "subCodes": ["SEALANT_SILIKON", "PRIMER_A", "CLEANER_B"],
    "status": "ganti",
    "updatedAt": "2026-07-21T08:20:00.000Z",
    "updatedBy": "editor@canonic.com"
  }
}
```

---

### 5.5 Delete Ordinance Rule
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Deletes an ordinance document from Firestore.

- **URL:** `/api/v1/ordinance/:id`
- **Method:** `DELETE`
- **Access:** Private (`requireAuth` + `requireRoles(['admin'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Ordinance \"ATURAN_PEMASANGAN_KACA_DEPAN\" deleted successfully.",
  "data": null
}
```

---

## 🤖 6. Automation CLI & Schema Services (`/api/v1/automation`)

### 6.1 Check Schema Version & Fetch Pure JSON Schema
🏷️ **Target Category:** `🤖 Automation CLI Only` (`authAutomationMiddleware`)  
Used by automation client scripts (e.g., Python/Node CLI) to check if the database schema has been updated since their last local check (`localVersion`). If `serverVersion === localVersion`, returns `304 Not Modified` to preserve bandwidth. Otherwise, dynamically formats all root documents into pure JSON and returns `200 OK`. Also enforces **Device ID Binding**.

- **URL:** `/api/v1/automation/schema/check-version`
- **Method:** `GET`
- **Access:** Private (`authAutomationMiddleware` - requires API Key + Device ID)
- **Headers Required:**
  ```http
  Authorization: Bearer <AUTOMATION_API_KEY>
  X-Device-ID: <DEVICE_HARDWARE_UUID>
  X-Device-Name: <OPTIONAL_PC_NAME>
  ```
- **Query Parameters:**
  - `type` (string, required): Allowed values: `DO` | `JC1` | `JC2` | `Finishing` | `FinishingSet` | `Ordinance`
  - `localVersion` (number, optional): Current version number stored locally on the client device.

#### Response when Schema Changed (`200 OK`)
```json
{
  "success": true,
  "type": "JC1",
  "version": 5,
  "fetchedAt": "2026-07-21T08:30:00.000Z",
  "data": {
    "PDC_BATCH_A_2026": {
      "batchNumber": "BATCH-001",
      "warehouseCode": "WH-JKT-01",
      "vehicleModels": {
        "TOYOTA_CAMRY_2024": {
          "code_1": "CHROME_TRIM",
          "code_2": "BLACK_LEATHER"
        }
      }
    }
  }
}
```

#### Response when Not Modified (`304 Not Modified`)
*(Empty body with HTTP status 304)*

#### Error Response when Device Bound to Another Hardware (`403 Forbidden`)
```json
{
  "success": false,
  "message": "DEVICE_MISMATCH: API Key telah terikat pada perangkat lain. Hubungi Admin untuk reset device binding.",
  "status": 403
}
```

---

### 6.2 Generate or Regenerate Automation API Key
🏷️ **Target Category:** `🌐 Web Frontend (FE)` (User Dashboard settings to create key for CLI)  
Generates a new secure API key (`can_...`) for the currently authenticated user. Saves the SHA-256 hash in Firestore (`automationKeyHash`) and returns the raw key **once** (`rawKey`). Also resets device binding automatically upon regeneration.

- **URL:** `/api/v1/automation/keys`
- **Method:** `POST`
- **Access:** Private (`requireAuth`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```
- **Request Body:** None

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "API key generated successfully.",
  "data": {
    "keyPrefix": "can_1a2b...",
    "rawKey": "can_1a2b3c4d5e6f7g8h9i0j...", // Store safely! Cannot be retrieved again.
    "status": "active",
    "updatedAt": "2026-07-21T08:30:00.000Z"
  }
}
```

---

### 6.3 Reset Device ID Binding (Admin Only)
🏷️ **Target Category:** `🌐 Web Frontend (FE)` (Admin Panel)  
Resets the `registeredDeviceId` and `registeredDeviceName` of a target user, allowing them to bind their automation API key to a new PC/device.

- **URL:** `/api/v1/automation/users/:userId/reset-device`
- **Method:** `POST`
- **Access:** Private (`requireAuth` + `requireRoles(['admin'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```
- **Path Parameters:**
  - `userId` (string, required): The target user's Firebase UID.

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Device binding reset successfully for user.",
  "data": {
    "userId": "google_sub_or_firebase_uid_456",
    "resetAt": "2026-07-21T08:35:00.000Z"
  }
}
```

---

### 6.4 Revoke Automation API Key (Admin Only)
🏷️ **Target Category:** `🌐 Web Frontend (FE)` (Admin Panel)  
Revokes the target user's active automation API key by clearing the hash and disabling access.

- **URL:** `/api/v1/automation/users/:userId/revoke`
- **Method:** `POST`
- **Access:** Private (`requireAuth` + `requireRoles(['admin'])`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```
- **Path Parameters:**
  - `userId` (string, required): The target user's Firebase UID.

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "Automation API key revoked successfully.",
  "data": {
    "userId": "google_sub_or_firebase_uid_456",
    "revokedAt": "2026-07-21T08:40:00.000Z"
  }
}
```

---

## 👥 7. User & Role Administration (`/api/v1/users`)

All endpoints under `/api/v1/users` require **Admin** privileges (`requireAuth` + `requireRoles(['admin'])`).

### 7.1 List All Registered Users
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Retrieves all user profile documents across the platform.

- **URL:** `/api/v1/users`
- **Method:** `GET`
- **Access:** Private (`Admin Only`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```
- **Query Parameters:**
  - `limit`, `page`, `offset` (pagination options)

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "User profiles list retrieved successfully.",
  "data": [
    {
      "id": "google_sub_or_firebase_uid_123",
      "email": "admin@canonic.com",
      "name": "Admin System",
      "role": "admin",
      "automationKeyPrefix": "can_1a2b...",
      "automationKeyStatus": "active",
      "registeredDeviceName": "DESKTOP-RYAN",
      "automationLastUsedAt": "2026-07-21T08:00:00.000Z",
      "createdAt": "2026-07-01T00:00:00.000Z"
    },
    {
      "id": "google_sub_or_firebase_uid_456",
      "email": "operator@canonic.com",
      "name": "Operator Gudang",
      "role": "editor",
      "automationKeyPrefix": null,
      "automationKeyStatus": null,
      "registeredDeviceName": null,
      "createdAt": "2026-07-15T00:00:00.000Z"
    }
  ]
}
```

---

### 7.2 Update User Role
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Changes the role (`admin`, `editor`, `viewer`) of a specific user. Prevents self-demotion (`Admin cannot revoke their own admin permissions`).

- **URL:** `/api/v1/users/:userId/role`
- **Method:** `PUT`
- **Access:** Private (`Admin Only`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  Content-Type: application/json
  ```
- **Path Parameters:**
  - `userId` (string, required): The target user's Firebase UID.
- **Request Body:**
  ```json
  {
    "role": "editor" // 'admin' | 'editor' | 'viewer'
  }
  ```

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "User role updated to \"editor\" successfully.",
  "data": {
    "id": "google_sub_or_firebase_uid_456",
    "email": "operator@canonic.com",
    "name": "Operator Gudang",
    "role": "editor",
    "updatedAt": "2026-07-21T08:40:00.000Z"
  }
}
```

---

### 7.3 Delete User Profile
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
Removes a user's profile document from Firestore **and natively revokes the Firebase Auth session**. Prevents self-deletion.

- **URL:** `/api/v1/users/:userId`
- **Method:** `DELETE`
- **Access:** Private (`Admin Only`)
- **Headers Required:**
  ```http
  Authorization: Bearer <ID_TOKEN>
  ```
- **Path Parameters:**
  - `userId` (string, required): The target user's Firebase UID.

#### Response (`200 OK`)
```json
{
  "success": true,
  "message": "User \"google_sub_or_firebase_uid_456\" profile deleted successfully.",
  "data": null
}
```

---

## 📊 8. Miscellaneous Mock & Job Endpoints

### 8.1 Vehicles Inventory Mock (`/api/v1/vehicles`)
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
- **GET `/api/v1/vehicles`**: Returns a mock list of vehicles.
- **POST `/api/v1/vehicles`**: Echoes back requested mock vehicle registration payload with ID `3`.

### 8.2 Reconciliation Reports Mock (`/api/v1/reconciliation`)
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
- **GET `/api/v1/reconciliation`**: Returns mock reconciliation summary records (`totalItems`, `discrepancies`, `status`).

### 8.3 Export Job Trigger (`/api/v1/export/csv`)
🏷️ **Target Category:** `🌐 Web Frontend (FE)`  
- **POST `/api/v1/export/csv`**: Triggers a background CSV export placeholder job and returns `jobId` along with a download URL.
