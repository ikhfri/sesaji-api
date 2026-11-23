# Dokumentasi API — Food Reports Module

Dokumentasi ini disusun dari source yang diberikan untuk `src/modules/food-reports/`.

> **Catatan kelengkapan source:** bagian awal `food-reports.controller.ts` tidak ikut terkirim. Karena itu, implementasi controller untuk `POST /` dan `GET /me` tidak dapat diverifikasi dari file ini. Route, validation, service, dan repository untuk kedua fitur tersebut tersedia dan didokumentasikan di bawah. Jangan menganggap contoh response/status yang tidak terlihat sebagai kontrak final.

## 1. Ringkasan

Food Reports digunakan untuk melaporkan masalah pada food listing, food request, atau delivery task, serta menyediakan alur peninjauan oleh admin.

Jenis laporan:
- `UNSAFE_FOOD`
- `FOOD_QUALITY`
- `DELIVERY_ISSUE`
- `MISCONDUCT`
- `OTHER`

Status laporan:
- `PENDING`
- `REVIEWING`
- `RESOLVED`
- `REJECTED`

Alur status yang terlihat dari repository:
`PENDING → REVIEWING → RESOLVED`

atau

`PENDING → REVIEWING → REJECTED`

Laporan baru dibuat dengan status default database yang tidak diperlihatkan pada module repository (insert tidak mengisi field `status`). Berdasarkan pemeriksaan status pada aksi review, status awal yang diharapkan adalah `PENDING`, tetapi nilai default schema perlu diverifikasi pada `database/schema/food-reports.ts`.

## 2. Autentikasi dan akses

Semua route menggunakan `router.use(authenticate)`, sehingga seluruh endpoint memerlukan autentikasi.

| Endpoint | Akses |
|---|---|
| `POST /` | User terautentikasi; pembatasan partisipasi diperiksa di repository |
| `GET /me` | User terautentikasi; hanya laporan milik reporter |
| `GET /admin` | `ADMIN` |
| `PATCH /:id/review` | `ADMIN` |
| `PATCH /:id/resolve` | `ADMIN` |
| `PATCH /:id/reject` | `ADMIN` |
| `GET /:id` | Admin atau reporter pemilik laporan |

Untuk detail:
- Jika role `ADMIN`, service mencari laporan berdasarkan ID tanpa filter reporter.
- Selain admin, service mencari laporan dengan kombinasi `id` dan `reporterId`.
- Jika tidak ditemukan, service mengembalikan 404. Dengan demikian, laporan milik user lain tidak dapat diambil melalui endpoint detail.

Service juga memeriksa role admin pada operasi daftar admin, review, resolve, dan reject. Jika role bukan `ADMIN`, error 403 `Admin access required`.

## 3. Endpoint

Prefix mount router tidak tampak pada source yang diberikan. Path di bawah adalah path relatif terhadap router module.

### 3.1 Membuat food report

`POST /`

**Middleware**
1. `authenticate`
2. `validate(createFoodReportSchema)`

**Request body**

```json
{
  "listingId": "uuid",
  "requestId": "uuid",
  "deliveryTaskId": "uuid",
  "type": "UNSAFE_FOOD",
  "description": "Deskripsi laporan minimal 10 karakter",
  "evidenceImageUrls": [
    "https://example.com/evidence.jpg"
  ]
}
```

Aturan validasi:
- `listingId`: UUID, wajib.
- `requestId`: UUID, opsional.
- `deliveryTaskId`: UUID, opsional.
- `type`: salah satu tipe laporan yang didukung.
- `description`: string di-trim, minimal 10 dan maksimal 5000 karakter.
- `evidenceImageUrls`: array URL valid, maksimal 5 item, default `[]`.
- Schema menggunakan `.strict()`, sehingga properti tambahan ditolak.

**Validasi relasi dan partisipasi di repository**
- Listing harus ada.
- Reporter tidak boleh melaporkan listing miliknya sendiri.
- Jika `requestId` diberikan:
  - Food request harus ada.
  - Request harus terkait dengan `listingId` yang sama.
  - Reporter harus merupakan recipient dari request tersebut atau donor pemilik listing.
- Jika `deliveryTaskId` diberikan:
  - Delivery task harus ada.
  - Jika `requestId` juga diberikan, task harus terkait dengan request tersebut.
  - Request milik task harus ada dan terkait dengan listing yang dilaporkan.
  - Reporter harus merupakan recipient request, donor listing, atau volunteer yang ditugaskan pada task.
- Jika `deliveryTaskId` diberikan tanpa `requestId`, repository menghubungkan report ke `requestId` milik delivery task.

Setelah validasi relasi, repository menyimpan `reporterId`, `listingId`, `requestId`, `deliveryTaskId`, `type`, `description`, dan `evidenceImageUrls`.

**Status dan response sukses:** controller bagian `createFoodReportController` tidak terdapat pada source yang dikirim, sehingga HTTP status, message, dan envelope response sukses tidak dapat dipastikan.

**Error yang dipetakan service**

| HTTP | Kondisi | Pesan |
|---:|---|---|
| 404 | Listing tidak ditemukan | `Food listing not found` |
| 403 | Melaporkan listing sendiri | `You cannot report your own listing` |
| 404 | Request tidak ditemukan | `Food request not found` |
| 400 | Request tidak terkait dengan listing | `Food request does not belong to this listing` |
| 403 | Reporter bukan participant request | `You are not a participant of this food request` |
| 404 | Delivery task tidak ditemukan | `Delivery task not found` |
| 400 | Task tidak sesuai dengan request yang dikirim | `Delivery task does not match the food request` |
| 400 | Task tidak terkait dengan listing | `Delivery task does not belong to this listing` |
| 403 | Reporter bukan participant task | `You are not a participant of this delivery task` |
| 500 | Error tidak dikenal atau hasil insert tidak tersedia | `Failed to create food report` |

### 3.2 Mengambil laporan milik sendiri

`GET /me`

**Middleware**
1. `authenticate`
2. `validateQuery(foodReportsQuerySchema)`

Query:
| Parameter | Tipe | Default | Aturan |
|---|---|---:|---|
| `page` | number | `1` | Integer minimal 1 |
| `limit` | number | `10` | Integer 1–50 |
| `status` | string | — | Opsional: `PENDING`, `REVIEWING`, `RESOLVED`, `REJECTED` |
| `type` | string | — | Opsional: tipe laporan yang didukung |

Repository hanya mengambil laporan dengan `reporterId` sama dengan user yang login. Filter `status` dan `type` diterapkan jika dikirim. Hasil diurutkan berdasarkan `createdAt DESC`, lalu dipaginasi.

Repository menghitung `totalItems` dengan mengambil daftar ID seluruh record yang sesuai filter, kemudian menggunakan panjang hasil tersebut. `totalPages` dihitung dengan `Math.ceil(totalItems / limit)`.

**Response sukses:** controller `getMyFoodReportsController` berada pada bagian awal file yang tidak terkirim, jadi status dan bentuk response sukses tidak dapat diverifikasi dari source ini.

### 3.3 Mengambil semua laporan (admin)

`GET /admin`

**Middleware**
1. `authenticate`
2. `authorize("ADMIN")`
3. `validateQuery(foodReportsQuerySchema)`

Query menggunakan parameter yang sama dengan `GET /me`.

Repository menerapkan filter opsional `status` dan `type`, mengurutkan berdasarkan `createdAt DESC`, lalu menggunakan pagination.

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Food reports retrieved successfully",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

Response di atas mengikuti controller yang tersedia. Isi `data` merupakan array record food report dari database.

### 3.4 Mengambil detail food report

`GET /:id`

**Middleware**
1. `authenticate`
2. `validateReportId`

`id` harus UUID. Jika tidak valid, route mengembalikan HTTP 400:

```json
{
  "success": false,
  "message": "Invalid food report ID",
  "errors": []
}
```

`errors` pada implementasi berisi `result.error.issues`; array kosong di atas hanya placeholder.

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Food report retrieved successfully",
  "data": {}
}
```

`data` adalah record food report yang ditemukan.

Error 404:
- `Food report not found` jika ID tidak ditemukan.
- Pesan yang sama juga digunakan jika user non-admin mencoba mengakses laporan milik user lain.

### 3.5 Memulai review laporan

`PATCH /:id/review`

**Middleware**
1. `authenticate`
2. `authorize("ADMIN")`
3. `validateReportId`
4. `validate(reviewFoodReportSchema)`

Request body:

```json
{
  "notes": "Catatan awal pemeriksaan"
}
```

Aturan:
- `notes` opsional.
- Jika diisi, string di-trim, minimal 3 dan maksimal 2000 karakter.
- Body strict; properti tambahan ditolak.

**Perilaku**
- Hanya report berstatus `PENDING` yang dapat dipindahkan ke review.
- Repository mengunci row report dengan `FOR UPDATE` dalam transaksi.
- Status diubah menjadi `REVIEWING`.
- `reviewedById` diisi dengan ID admin.
- `reviewedAt` diisi waktu sekarang.
- `resolutionNotes` diisi `notes` atau `null`.
- `updatedAt` diperbarui.

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Food report moved to review",
  "data": {}
}
```

Error:
| HTTP | Kondisi | Pesan |
|---:|---|---|
| 403 | Role bukan admin | `Admin access required` |
| 404 | Report tidak ditemukan | `Food report not found` |
| 409 | Status report bukan `PENDING` | `Food report cannot be changed from its current status` |
| 500 | Gagal memperbarui report | `Failed to update food report` |

### 3.6 Menyelesaikan laporan

`PATCH /:id/resolve`

**Middleware**
1. `authenticate`
2. `authorize("ADMIN")`
3. `validateReportId`
4. `validate(resolveFoodReportSchema)`

Request body:

```json
{
  "resolutionNotes": "Penjelasan penyelesaian laporan"
}
```

Aturan:
- `resolutionNotes` wajib.
- String di-trim, minimal 3 dan maksimal 2000 karakter.
- Body strict.

**Perilaku**
- Hanya report berstatus `REVIEWING` yang dapat diselesaikan.
- Repository mengunci row menggunakan `FOR UPDATE` dalam transaksi.
- Status diubah menjadi `RESOLVED`.
- `reviewedById` diisi ID admin.
- `resolutionNotes` diisi dari request.
- `reviewedAt` dipertahankan jika sudah ada; jika belum, diisi waktu sekarang.
- `resolvedAt` dan `updatedAt` diisi waktu sekarang.

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Food report resolved successfully",
  "data": {}
}
```

Error status tidak valid: HTTP 409, `Food report cannot be changed from its current status`. Error lain mengikuti pemetaan review: 404 jika report tidak ditemukan, 403 jika bukan admin, dan 500 jika gagal.

### 3.7 Menolak laporan

`PATCH /:id/reject`

**Middleware**
1. `authenticate`
2. `authorize("ADMIN")`
3. `validateReportId`
4. `validate(rejectFoodReportSchema)`

Request body:

```json
{
  "resolutionNotes": "Alasan penolakan laporan"
}
```

Aturan:
- `resolutionNotes` wajib.
- String di-trim, minimal 3 dan maksimal 2000 karakter.
- Body strict.

**Perilaku**
- Hanya report berstatus `REVIEWING` yang dapat ditolak.
- Repository mengunci row menggunakan `FOR UPDATE` dalam transaksi.
- Status diubah menjadi `REJECTED`.
- `reviewedById` diisi ID admin.
- `resolutionNotes` diisi dari request.
- `reviewedAt` dipertahankan jika sudah ada; jika belum, diisi waktu sekarang.
- `resolvedAt` dan `updatedAt` diisi waktu sekarang.

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Food report rejected successfully",
  "data": {}
}
```

Error status tidak valid: HTTP 409, `Food report cannot be changed from its current status`. Error lain mengikuti pemetaan review.

## 4. Ringkasan alur status

| Status saat ini | Aksi | Status berikutnya |
|---|---|---|
| `PENDING` | Admin memulai review | `REVIEWING` |
| `REVIEWING` | Admin resolve | `RESOLVED` |
| `REVIEWING` | Admin reject | `REJECTED` |

Repository menolak perubahan status jika status saat ini tidak sesuai dengan aksi. Pengecekan dilakukan di dalam transaksi setelah row dikunci dengan `FOR UPDATE`.

## 5. Jenis laporan dan tipe data

### `FoodReportType`

| Nilai | Makna berdasarkan identifier |
|---|---|
| `UNSAFE_FOOD` | Laporan keamanan makanan |
| `FOOD_QUALITY` | Laporan kualitas makanan |
| `DELIVERY_ISSUE` | Masalah pengiriman |
| `MISCONDUCT` | Perilaku tidak pantas |
| `OTHER` | Lainnya |

### `FoodReportStatus`

| Nilai |
|---|
| `PENDING` |
| `REVIEWING` |
| `RESOLVED` |
| `REJECTED` |

### Interface input

- `CreateFoodReportInput`: `listingId`, optional `requestId`, optional `deliveryTaskId`, `type`, `description`, `evidenceImageUrls`.
- `FoodReportsFilter`: `page`, `limit`, optional `status`, optional `type`.
- `ReviewFoodReportInput`: optional `notes`.
- `ResolveFoodReportInput`: required `resolutionNotes`.
- `RejectFoodReportInput`: required `resolutionNotes`.

## 6. Catatan implementasi

- Pembuatan laporan menggunakan transaksi database untuk memeriksa listing, request, dan delivery task sebelum insert.
- Report tidak dapat dibuat oleh donor terhadap listing miliknya sendiri.
- Reporter harus memiliki relasi partisipasi yang sesuai jika melampirkan request atau delivery task.
- Operasi review, resolve, dan reject menggunakan transaksi serta row-level lock (`FOR UPDATE`) untuk mencegah perubahan status bersamaan yang tidak sesuai.
- Query daftar user dibatasi oleh `reporterId`; query admin tidak memiliki pembatas reporter.
- Source module tidak menunjukkan proses upload bukti gambar. `evidenceImageUrls` hanya divalidasi sebagai URL dan disimpan sebagai array.
- Tidak terlihat notifikasi, penghapusan laporan, atau perubahan langsung pada status food listing/delivery task sebagai efek dari review report.

## 7. Hal yang perlu diverifikasi di source lain

1. Bagian awal `food-reports.controller.ts`, khususnya controller create dan list milik user, termasuk response status/message/envelope.
2. Default status dan definisi kolom pada `database/schema/food-reports.ts`.
3. Prefix router saat dipasang di aplikasi Express.
4. Global error handler untuk bentuk final response dari `AppError`.
5. Apakah ada validasi role/partisipasi tambahan pada middleware atau layer lain di luar module ini.

