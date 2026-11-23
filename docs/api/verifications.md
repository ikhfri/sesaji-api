# SESAJI API — Verifications Module

> Dokumentasi ini disusun dari source yang dikirim. File yang terlihat mencakup potongan `verifications.repository.ts`, routes, service, types, dan validation. `verifications.controller.ts`, bagian awal repository (termasuk deklarasi `REQUIRED_ROLES`), router mount, serta implementasi R2 tidak terlihat. Karena itu response sukses dan status HTTP sukses belum dapat dipastikan.

## 1. Ringkasan

Verifications menangani pengajuan verifikasi akun untuk tiga tipe:
- `DONOR_BUSINESS`
- `RECEIVER`
- `VOLUNTEER`

Pengguna mengunggah dokumen ke private R2 melalui signed upload URL, kemudian mengirim object key dokumen saat membuat pengajuan. Admin dapat melihat daftar pengajuan, menyetujui, atau menolak pengajuan. Pemilik pengajuan dan admin dapat meminta signed download URL untuk dokumen privat.

## 2. Status dan tipe verifikasi

### Verification type

| Tipe | Role yang diharapkan oleh service |
|---|---|
| `DONOR_BUSINESS` | `DONOR_BUSINESS` |
| `RECEIVER` | `RECEIVER` |
| `VOLUNTEER` | `VOLUNTEER` |

Service memeriksa role pengguna terhadap `verificationType` sebelum memvalidasi dokumen dan menyimpan pengajuan. Repository juga melakukan pemeriksaan role terhadap data user dan roles di dalam transaksi. Deklarasi mapping `REQUIRED_ROLES` di repository tidak terlihat pada source yang dikirim.

### Verification status

| Status | Makna |
|---|---|
| `PENDING` | Pengajuan menunggu review admin |
| `APPROVED` | Pengajuan disetujui |
| `REJECTED` | Pengajuan ditolak |

Pengajuan baru dibuat dengan status `PENDING`. Pengajuan terbaru dengan status `PENDING` atau `APPROVED` mencegah pengajuan baru untuk user dan tipe verifikasi yang sama. Pengajuan yang terakhir berstatus `REJECTED` dapat diajukan kembali menurut pemeriksaan repository yang terlihat.

## 3. Authentication dan authorization

Semua route menggunakan `authenticate`, sehingga seluruh endpoint memerlukan autentikasi.

| Endpoint | Akses |
|---|---|
| `POST /upload-url` | Role `DONOR_BUSINESS`, `RECEIVER`, `VOLUNTEER` |
| `POST /` | Role harus cocok dengan `verificationType` |
| `GET /me` | Semua user terautentikasi |
| `GET /:id/documents/:documentId/url` | Pemilik verifikasi atau `ADMIN` |
| `GET /admin` | `ADMIN` |
| `PATCH /:id/approve` | `ADMIN` |
| `PATCH /:id/reject` | `ADMIN` |
| `GET /:id` | Pemilik verifikasi atau `ADMIN` |

Route detail tidak memasang `authorize("ADMIN")` karena pemeriksaan akses dilakukan di service: pemilik verifikasi boleh melihat detail, selain pemilik hanya `ADMIN` yang diizinkan.

## 4. Endpoint

Path berikut relatif terhadap router verifications. Prefix mount di API entry point tidak disertakan.

| Method | Path | Fungsi |
|---|---|---|
| `POST` | `/upload-url` | Membuat signed upload URL dokumen |
| `POST` | `/` | Mengirim pengajuan verifikasi beserta dokumen |
| `GET` | `/me` | Melihat riwayat verifikasi sendiri |
| `GET` | `/:id/documents/:documentId/url` | Membuat signed download URL dokumen |
| `GET` | `/admin` | Daftar pengajuan untuk admin |
| `PATCH` | `/:id/approve` | Menyetujui pengajuan |
| `PATCH` | `/:id/reject` | Menolak pengajuan |
| `GET` | `/:id` | Detail pengajuan |

## 5. Detail endpoint

### 5.1 Generate document upload URL

`POST /upload-url`

Role yang diizinkan: `DONOR_BUSINESS`, `RECEIVER`, `VOLUNTEER`.

Request body:

```json
{
  "originalFilename": "dokumen-usaha.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 2048000
}
```

Validasi:
- `originalFilename`: string di-trim, 1–255 karakter.
- `contentType`: salah satu `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
- `sizeBytes`: integer positif, maksimum 10 MB.
- Object strict; field tambahan ditolak.

Business rules:
1. Role harus termasuk `DONOR_BUSINESS`, `RECEIVER`, atau `VOLUNTEER`.
2. Ukuran harus lebih dari 0 dan tidak lebih dari 10 MB.
3. MIME harus didukung.
4. Object key dibuat dengan pola `verification-documents/{userId}/{randomUUID}.{extension}`.
5. Extension:
   - `application/pdf` → `pdf`
   - `image/jpeg` → `jpg`
   - `image/png` → `png`
   - `image/webp` → `webp`
6. Service meminta signed upload URL ke R2 melalui `createUploadUrl`.
7. Jika pembuatan signed URL gagal, service mengembalikan `502`.

Bentuk data hasil service:

```json
{
  "uploadUrl": "SIGNED_UPLOAD_URL",
  "objectKey": "verification-documents/USER_UUID/GENERATED_UUID.pdf",
  "method": "PUT",
  "headers": {
    "Content-Type": "application/pdf"
  },
  "expiresIn": 900
}
```

`expiresIn` di atas hanya contoh nilai. Nilai aktual berasal dari `createUploadUrl`.

Validasi body dilakukan oleh route melalui `verificationUploadUrlSchema`. HTTP status dan envelope response endpoint tidak dapat dipastikan karena controller tidak disertakan.

Error service:
| HTTP | Message |
|---:|---|
| 403 | `Your role cannot submit verification documents` |
| 422 | `Document size must not exceed 10 MB` |
| 422 | `Unsupported document format` |
| 502 | `Failed to generate document upload URL` |

### 5.2 Submit verification

`POST /`

Request body:

```json
{
  "verificationType": "DONOR_BUSINESS",
  "documents": [
    {
      "documentType": "BUSINESS_LICENSE",
      "objectKey": "verification-documents/USER_UUID/GENERATED_UUID.pdf",
      "originalFilename": "dokumen-usaha.pdf"
    }
  ]
}
```

Validasi:
- `verificationType`: `DONOR_BUSINESS`, `RECEIVER`, atau `VOLUNTEER`.
- `documents`: array 1–5 dokumen.
- `documentType`: string di-trim, 1–100 karakter.
- `objectKey`: string di-trim, 1–500 karakter; tidak boleh diawali `/`, mengandung `..`, atau mengandung backslash (`\`).
- `originalFilename`: string di-trim, 1–255 karakter.
- Setiap object dokumen strict; object request juga strict.

Validasi tambahan di service terhadap private R2:
1. Jumlah dokumen harus 1–5.
2. Setiap `objectKey` harus diawali `verification-documents/{userId}/`, sehingga dokumen harus berada di folder milik user yang terautentikasi.
3. Object key ditolak jika mengandung `..`, diawali `/`, atau mengandung backslash.
4. Object harus ditemukan di R2.
5. MIME aktual dari metadata object (di-lowercase) harus salah satu `application/pdf`, `image/jpeg`, `image/png`, `image/webp`.
6. Ukuran aktual harus lebih dari 0 dan maksimal 10 MB.

Business rules:
1. `verificationType` harus sesuai dengan role user:
   - `DONOR_BUSINESS` ↔ `DONOR_BUSINESS`
   - `RECEIVER` ↔ `RECEIVER`
   - `VOLUNTEER` ↔ `VOLUNTEER`
2. Repository mengambil row user dan role, lalu menguncinya (`FOR UPDATE`) dalam transaksi.
3. Repository menolak user yang tidak ditemukan atau role yang tidak sesuai.
4. Repository memeriksa pengajuan terbaru untuk kombinasi user dan verification type.
5. Jika pengajuan terbaru berstatus `PENDING` atau `APPROVED`, pengajuan baru ditolak.
6. Pengajuan baru disimpan dengan status `PENDING`.
7. Metadata dokumen disimpan dalam transaksi yang sama. Kolom `verificationDocuments.fileUrl` diisi dengan private R2 object key, bukan public URL.

Error service:
| HTTP | Message |
|---:|---|
| 403 | `Your role cannot submit this verification` |
| 422 | `Verification requires 1-5 documents` |
| 403 | `Invalid verification document ownership` |
| 422 | `Verification document not found: {originalFilename}` |
| 422 | `Unsupported verification document format` |
| 422 | `Verification document must not exceed 10 MB` |
| 404 | `User not found` |
| 403 | `Invalid verification type for this account` |
| 409 | `An active or approved verification already exists` |
| 500 | `Failed to submit verification` |

Catatan: validasi Zod menerima 1–5 dokumen, sehingga pemeriksaan jumlah di service mengulang batas tersebut. Error repository untuk user/role/pengajuan dipetakan service ke status di tabel.

### 5.3 Get my verifications

`GET /me`

Semua user terautentikasi.

Mengambil seluruh pengajuan milik `userId` dari token, diurutkan berdasarkan `submittedAt` descending.

Field yang dipilih repository:
- `id`
- `verificationType`
- `status`
- `submittedAt`
- `reviewedAt`
- `rejectionReason`

Tidak ada pagination atau query filter pada route ini.

HTTP status sukses dan envelope response tidak terlihat karena controller tidak disertakan.

### 5.4 Get verification detail

`GET /:id`

Path parameter:
- `id`: UUID.

Validasi parameter dilakukan manual di route. Jika tidak valid, route mengembalikan:

```json
{
  "success": false,
  "message": "Invalid verification ID",
  "errors": [
    {
      "field": "id",
      "message": "Invalid UUID"
    }
  ]
}
```

HTTP status validasi: `422`.

Authorization:
- User pemilik pengajuan boleh melihat.
- `ADMIN` boleh melihat semua pengajuan.
- User lain menerima `403`.

Field detail dari repository:
- `id`
- `userId`
- `verificationType`
- `status`
- `submittedAt`
- `reviewedBy`
- `reviewedAt`
- `rejectionReason`
- `createdAt`
- `documents[]`:
  - `id`
  - `documentType`
  - `objectKey`
  - `originalFilename`
  - `createdAt`

Service secara eksplisit tidak mengekspos private R2 object key sebagai public URL. Detail tetap mengandung field `objectKey` pada `documents`; akses file dilakukan melalui endpoint signed download URL.

Error:
| HTTP | Message |
|---:|---|
| 404 | `Verification not found` |
| 403 | `You are not authorized to view this verification` |

### 5.5 Get verification document URL

`GET /:id/documents/:documentId/url`

Path parameters:
- `id`: UUID verification.
- `documentId`: UUID document.

Route memvalidasi kedua parameter menggunakan `verificationParamsSchema` (schema berisi properti `id` bertipe UUID). Jika salah satu tidak valid, route mengembalikan `422`:

```json
{
  "success": false,
  "message": "Invalid verification or document ID"
}
```

Business rules:
1. Verification harus ditemukan.
2. Hanya pemilik verification atau `ADMIN` yang boleh mengakses dokumennya.
3. `documentId` harus termasuk dalam daftar dokumen milik verification tersebut.
4. Service membuat signed download URL menggunakan private `objectKey` dari dokumen.
5. Masa berlaku yang dikembalikan service adalah `300` detik.
6. Jika pembuatan signed URL gagal, service mengembalikan `502`.

Bentuk data hasil service:

```json
{
  "downloadUrl": "SIGNED_DOWNLOAD_URL",
  "expiresIn": 300
}
```

Error:
| HTTP | Message |
|---:|---|
| 404 | `Verification not found` |
| 403 | `You are not authorized to access these documents` |
| 404 | `Verification document not found` |
| 502 | `Failed to generate document access URL` |

### 5.6 Admin list verifications

`GET /admin`

Role: `ADMIN`.

Query parameters:

| Parameter | Tipe / nilai | Default |
|---|---|---|
| `status` | `PENDING`, `APPROVED`, `REJECTED` | — |
| `verificationType` | `DONOR_BUSINESS`, `RECEIVER`, `VOLUNTEER` | — |
| `page` | Integer minimal 1 | `1` |
| `limit` | Integer 1–50 | `20` |

Query menggunakan coercion untuk `page` dan `limit`, serta strict object.

Repository:
- Filter berdasarkan `status` jika dikirim.
- Filter berdasarkan `verificationType` jika dikirim.
- Urutkan `submittedAt` descending.
- Menggunakan limit dan offset.
- Menghitung total data untuk pagination.

Field item:
- `id`
- `userId`
- `userName`
- `userEmail`
- `verificationType`
- `status`
- `submittedAt`
- `reviewedAt`
- `rejectionReason`

Bentuk data repository:

```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

Service juga memeriksa role `ADMIN`, selain middleware `authorize("ADMIN")` pada route.

### 5.7 Approve verification

`PATCH /:id/approve`

Role: `ADMIN`.

Path parameter:
- `id`: UUID verification.

Request body: tidak diperlukan oleh route.

Business rules:
1. Hanya admin yang dapat melakukan review.
2. Verification harus ditemukan.
3. Hanya status `PENDING` yang dapat direview.
4. Status diubah menjadi `APPROVED`.
5. `reviewedBy` diisi dengan `adminId`.
6. `reviewedAt` diisi waktu saat review.
7. `rejectionReason` di-set `null`.
8. Update dilakukan dalam transaksi dengan row verification dikunci (`FOR UPDATE`).
9. Setelah berhasil, service mencoba mengirim notifikasi `VERIFICATION_APPROVED` kepada pemilik pengajuan.

Notifikasi:
- Title: `Verifikasi disetujui`
- Body: `Pengajuan verifikasi akun SESAJI kamu telah disetujui.`
- Data: `verificationId`, `verificationType`, `status: APPROVED`

Error:
| HTTP | Message |
|---:|---|
| 403 | `Only administrators can review verifications` |
| 404 | `Verification not found` |
| 409 | `This verification has already been reviewed` |
| 500 | `Failed to review verification` |

### 5.8 Reject verification

`PATCH /:id/reject`

Role: `ADMIN`.

Path parameter:
- `id`: UUID verification.

Request body:

```json
{
  "rejectionReason": "Dokumen legalitas usaha tidak terbaca dengan jelas."
}
```

Validasi:
- `rejectionReason`: string di-trim, minimal 10 dan maksimal 2000 karakter.
- Object strict.

Service juga memeriksa bahwa alasan penolakan ada dan minimal 10 karakter setelah trim. Repository mengubah status menjadi `REJECTED`, menyimpan `reviewedBy`, `reviewedAt`, dan `rejectionReason`.

Setelah berhasil, service mencoba mengirim notifikasi `VERIFICATION_REJECTED` kepada pemilik pengajuan.

Notifikasi:
- Title: `Verifikasi ditolak`
- Body: `Pengajuan verifikasi akun SESAJI kamu ditolak. Alasan: {rejectionReason}`
- Data: `verificationId`, `verificationType`, `status: REJECTED`

Error:
| HTTP | Message |
|---:|---|
| 403 | `Only administrators can review verifications` |
| 422 | `Rejection reason must contain at least 10 characters` |
| 404 | `Verification not found` |
| 409 | `This verification has already been reviewed` |
| 500 | `Failed to review verification` |

## 6. Alur upload dokumen verifikasi

```text
Client
  |
  | 1. POST /upload-url
  |    originalFilename, contentType, sizeBytes
  v
SESAJI API
  |
  | 2. Return uploadUrl + objectKey
  v
Client
  |
  | 3. PUT file ke signed uploadUrl
  |    Content-Type sesuai MIME
  v
Private Cloudflare R2
  |
  | 4. Upload selesai
  v
Client
  |
  | 5. POST / dengan verificationType + documents[]
  v
SESAJI API
  |
  | 6. Validasi ownership objectKey
  | 7. Periksa metadata aktual R2
  | 8. Simpan verification + metadata dokumen
  v
Database
```

### Contoh PUT ke storage

```http
PUT SIGNED_UPLOAD_URL
Content-Type: application/pdf

(binary file)
```

Dokumen disimpan sebagai private object. Untuk membacanya, client meminta signed download URL melalui endpoint `GET /:id/documents/:documentId/url`; jangan mengandalkan public URL.

## 7. Contoh pengujian Bruno

Sesuaikan `baseUrl` dan prefix router dengan konfigurasi aplikasi.

### Generate upload URL

```http
POST {{baseUrl}}/verifications/upload-url
Authorization: Bearer {{userToken}}
Content-Type: application/json
```

```json
{
  "originalFilename": "dokumen-usaha.pdf",
  "contentType": "application/pdf",
  "sizeBytes": 2048000
}
```

Lalu upload file dengan `PUT` ke `uploadUrl` yang dikembalikan, menggunakan header `Content-Type` yang sama.

### Submit verification

```http
POST {{baseUrl}}/verifications
Authorization: Bearer {{userToken}}
Content-Type: application/json
```

```json
{
  "verificationType": "DONOR_BUSINESS",
  "documents": [
    {
      "documentType": "BUSINESS_LICENSE",
      "objectKey": "{{objectKey}}",
      "originalFilename": "dokumen-usaha.pdf"
    }
  ]
}
```

### Get my verifications

```http
GET {{baseUrl}}/verifications/me
Authorization: Bearer {{userToken}}
```

### Get verification detail

```http
GET {{baseUrl}}/verifications/{{verificationId}}
Authorization: Bearer {{userToken}}
```

### Get private document URL

```http
GET {{baseUrl}}/verifications/{{verificationId}}/documents/{{documentId}}/url
Authorization: Bearer {{userToken}}
```

### Admin list

```http
GET {{baseUrl}}/verifications/admin?page=1&limit=20&status=PENDING
Authorization: Bearer {{adminToken}}
```

### Approve

```http
PATCH {{baseUrl}}/verifications/{{verificationId}}/approve
Authorization: Bearer {{adminToken}}
```

### Reject

```http
PATCH {{baseUrl}}/verifications/{{verificationId}}/reject
Authorization: Bearer {{adminToken}}
Content-Type: application/json
```

```json
{
  "rejectionReason": "Dokumen legalitas usaha tidak terbaca dengan jelas."
}
```

## 8. Catatan implementasi dan hal yang perlu diverifikasi

1. **Controller tidak disertakan.** Status HTTP sukses, envelope response, dan pesan sukses endpoint tidak dapat didokumentasikan secara pasti.
2. **Bagian awal repository tidak terlihat.** Deklarasi `REQUIRED_ROLES` dan awal fungsi create tidak tersedia; pemetaan role pada tabel didasarkan pada service dan tipe verifikasi yang terlihat.
3. **Dokumen bersifat private.** Repository menyimpan object key pada `verificationDocuments.fileUrl`, bukan public URL. Detail mengembalikan `objectKey`; endpoint signed URL menjadi jalur akses file.
4. **Upload URL dan submit adalah dua tahap terpisah.** Submit memeriksa object aktual di R2, bukan hanya mempercayai ukuran/MIME yang dikirim saat meminta upload URL.
5. **Batas jumlah dokumen adalah 1–5** dan batas ukuran setiap dokumen adalah 10 MB.
6. **Tidak terlihat cleanup object R2 jika submit verification gagal.** Source yang diberikan tidak menunjukkan penghapusan object yang sudah di-upload ketika validasi lanjutan atau penyimpanan database gagal.
7. **Review hanya menerima status `PENDING`.** Pengajuan `APPROVED` atau `REJECTED` tidak dapat direview ulang.
8. **Pengajuan ulang setelah REJECTED diperbolehkan oleh pemeriksaan repository yang terlihat**, karena hanya status terbaru `PENDING` dan `APPROVED` yang memblokir pengajuan baru.
9. **Notifikasi review menggunakan `createNotificationSafely`.** Implementasi helper tidak disertakan.
10. **Validasi parameter dokumen memakai schema parameter `id` yang sama** dengan UUID. Route memvalidasi `req.params.documentId` dengan membungkusnya sebagai `{ id: documentId }`.
11. **Tidak ada bukti di service ini bahwa approval otomatis mengubah role user atau profil.** Service yang terlihat memperbarui record verifikasi dan mengirim notifikasi; efek samping lain tidak boleh diasumsikan.
12. **Prefix router belum diverifikasi.** Contoh Bruno menggunakan `/verifications` berdasarkan komentar route, tetapi mount aplikasi tidak disertakan.

## 9. Source yang tercakup

- Potongan `verifications.repository.ts` (bagian awal tidak lengkap)
- `verifications.routes.ts`
- `verifications.service.ts`
- `verifications.types.ts`
- `verifications.validation.ts`

Tidak disertakan:
- `verifications.controller.ts`
- bagian awal repository yang memuat deklarasi role mapping
- schema database lengkap `verifications` dan `verificationDocuments`
- implementasi integrasi R2 (`r2.client.ts`)
- router mount / API entry point
- implementasi `createNotificationSafely`
