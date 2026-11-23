# SESAJI API — Food Requests Module

> Dokumentasi ini disusun dari source module `food-requests` yang diberikan. File controller tidak terlihat dalam source yang dikirim, sehingga bentuk response HTTP sukses, status HTTP, dan envelope response belum dapat dipastikan. Prefix mount router juga tidak terlihat.

## 1. Ringkasan

Food Requests mengelola permintaan makanan dari penerima kepada donor. Modul menyediakan pembuatan permintaan, daftar permintaan milik pengguna, daftar permintaan masuk untuk donor, detail permintaan, respons donor (approve/reject), dan pembatalan oleh penerima.

### Status permintaan yang digunakan

| Status | Makna berdasarkan implementasi |
|---|---|
| `PENDING` | Permintaan baru dibuat dan menunggu respons donor |
| `APPROVED` | Disetujui donor |
| `REJECTED` | Ditolak donor |
| `CANCELLED` | Dibatalkan penerima |
| `IN_PROGRESS` | Termasuk status yang dapat difilter; perubahan status tidak dilakukan oleh fungsi di module ini |
| `COMPLETED` | Termasuk status yang dapat difilter; perubahan status tidak dilakukan oleh fungsi di module ini |
| `EXPIRED` | Termasuk status yang dapat difilter; perubahan status tidak dilakukan oleh fungsi di module ini |
| `FAILED` | Termasuk status yang dapat difilter; perubahan status tidak dilakukan oleh fungsi di module ini |

`ACTIVE_REQUEST_STATUSES` dideklarasikan di repository sebagai `PENDING`, `APPROVED`, dan `IN_PROGRESS`, tetapi pada potongan source yang diberikan konstanta tersebut tidak digunakan.

## 2. Authentication dan authorization

Semua route menggunakan middleware `authenticate`.

| Role | Akses |
|---|---|
| `RECEIVER` | Membuat permintaan, melihat daftar permintaan sendiri, melihat detail jika merupakan recipient, membatalkan permintaan |
| `DONOR_INDIVIDUAL` | Melihat daftar permintaan (`/me` diarahkan ke incoming), melihat permintaan masuk, merespons permintaan, melihat detail jika merupakan donor |
| `DONOR_BUSINESS` | Sama dengan `DONOR_INDIVIDUAL` |
| `ADMIN` | Dapat mengakses route detail `GET /:id`; service mengizinkan admin melihat detail |

Catatan: route `GET /me` mengizinkan receiver dan kedua role donor. Service memilih data berdasarkan role: receiver memperoleh permintaan yang dibuatnya, sedangkan donor memperoleh permintaan masuk pada listing miliknya. Route `GET /:id` juga mengizinkan tiga role di atas plus `ADMIN`, tetapi service tetap memeriksa bahwa pengguna adalah recipient, donor pemilik listing, atau admin.

## 3. Endpoint

Path di bawah bersifat relatif terhadap router `food-requests`. Prefix mount pada aplikasi tidak ada di source yang dikirim.

| Method | Path | Role | Fungsi |
|---|---|---|---|
| `POST` | `/` | `RECEIVER` | Membuat permintaan makanan |
| `GET` | `/me` | `RECEIVER`, `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` | Daftar permintaan milik pengguna / permintaan masuk donor |
| `GET` | `/incoming` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` | Daftar permintaan masuk untuk donor |
| `PATCH` | `/:id/respond` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` | Menyetujui atau menolak permintaan |
| `PATCH` | `/:id/cancel` | `RECEIVER` | Membatalkan permintaan |
| `GET` | `/:id` | `RECEIVER`, `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`, `ADMIN` | Detail permintaan |

## 4. Detail endpoint

### 4.1 Membuat permintaan makanan

`POST /`

Role: `RECEIVER`

Request body:

```json
{
  "listingId": "UUID",
  "requestedPortions": 2,
  "fulfillmentMethod": "SELF_PICKUP",
  "recipientNotes": "Saya akan mengambil sekitar pukul 15.00."
}
```

Validasi:
- `listingId`: UUID, wajib.
- `requestedPortions`: integer positif, wajib.
- `fulfillmentMethod`: `SELF_PICKUP` atau `VOLUNTEER_DELIVERY`; boleh `null` atau tidak dikirim.
- `recipientNotes`: string, di-trim, maksimal 2000 karakter; boleh `null` atau tidak dikirim.
- Object strict: field tambahan ditolak.

Business rules:
1. Hanya role `RECEIVER` yang dapat membuat permintaan.
2. Receiver harus ditemukan.
3. Receiver wajib memiliki verifikasi bertipe `RECEIVER` dengan status `APPROVED`.
4. Listing harus ditemukan.
5. Receiver tidak boleh meminta listing miliknya sendiri.
6. Listing harus berstatus `ACTIVE`, memiliki minimal satu porsi tersedia, dan `pickupDeadline` harus masih di masa depan.
7. Jumlah porsi yang diminta tidak boleh melebihi `availablePortions`.
8. Permintaan dibuat dengan status `PENDING`.
9. Pembuatan dilakukan dalam transaksi database dan row listing dikunci (`FOR UPDATE`) agar proses pembuatan permintaan terserialisasi dengan operasi lain yang mengunci listing.
10. Setelah berhasil, sistem mencoba mengirim notifikasi `NEW_FOOD_REQUEST` kepada donor. Notifikasi menggunakan helper `createNotificationSafely`.

Error yang dipetakan service:
| HTTP | Message |
|---:|---|
| 403 | `Only receivers can create food requests` |
| 404 | `Receiver not found` |
| 403 | `Receiver verification is required` |
| 404 | `Food listing not found` |
| 409 | `Food listing is no longer available` |
| 403 | `You cannot request your own food listing` |
| 400 | `Requested portions exceed available portions` |
| 500 | `Failed to create food request` |

Repository juga dapat melempar `FOOD_REQUEST_CREATION_FAILED` jika insert tidak mengembalikan row; pemetaan HTTP akhirnya bergantung pada error handler global yang tidak disertakan.

### 4.2 Daftar permintaan pengguna

`GET /me`

Role: `RECEIVER`, `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`

Query parameters:

| Parameter | Tipe / nilai | Default | Keterangan |
|---|---|---|---|
| `status` | Enum status | — | Filter status opsional |
| `page` | Integer, minimal 1 | `1` | Halaman |
| `limit` | Integer, 1–50 | `20` | Jumlah item per halaman |

Enum `status`:
`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`, `EXPIRED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`.

Perilaku berdasarkan role:
- `RECEIVER`: mengambil permintaan dengan `recipientId` milik pengguna.
- `DONOR_INDIVIDUAL` dan `DONOR_BUSINESS`: mengambil permintaan yang terkait dengan listing milik donor (incoming requests).

Urutan: `createdAt` descending.

Bentuk data repository untuk receiver:
- `id`
- `listingId`
- `listingName`
- `requestedPortions`
- `fulfillmentMethod`
- `status`
- `createdAt`
- `pickupDeadline`

Bentuk data repository untuk donor:
- `id`
- `recipientId`
- `recipientName`
- `listingId`
- `listingName`
- `requestedPortions`
- `fulfillmentMethod`
- `recipientNotes`
- `status`
- `createdAt`

Keduanya mengembalikan struktur repository:

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

### 4.3 Daftar permintaan masuk donor

`GET /incoming`

Role: `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`

Query parameters sama dengan `GET /me`:
- `status`: enum status opsional.
- `page`: integer minimal 1, default `1`.
- `limit`: integer 1–50, default `20`.

Data difilter berdasarkan `foodListings.donorId` milik donor, opsional berdasarkan status, dan diurutkan dari `createdAt` terbaru. Data item sama dengan bentuk data donor pada `GET /me`.

### 4.4 Merespons permintaan

`PATCH /:id/respond`

Role: `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`

Path parameter:
- `id`: UUID food request.

Request body untuk approve:

```json
{
  "action": "APPROVE"
}
```

Request body untuk reject:

```json
{
  "action": "REJECT",
  "rejectionReason": "Stok makanan sudah tidak dapat dipenuhi."
}
```

Validasi:
- `action`: `APPROVE` atau `REJECT`, wajib.
- `rejectionReason`: string di-trim, panjang 1–1000 karakter, opsional secara field.
- Jika `action` adalah `REJECT`, `rejectionReason` wajib berisi teks setelah trim.
- Object strict: field tambahan ditolak.
- `id` harus UUID.

Business rules:
1. Request harus ditemukan.
2. Listing terkait harus ditemukan.
3. Donor yang melakukan respons harus merupakan pemilik listing.
4. Hanya request berstatus `PENDING` yang dapat diproses.
5. Untuk `APPROVE`, listing harus `ACTIVE`, `pickupDeadline` belum lewat, dan stok tersedia harus cukup.
6. Jika disetujui, `requestedPortions` dikurangi dari `availablePortions`.
7. Jika sisa porsi menjadi `0`, status listing berubah menjadi `FULLY_RESERVED`; jika masih ada sisa, status listing tetap `ACTIVE`.
8. Status request berubah menjadi `APPROVED` dan `respondedAt` diisi.
9. Jika ditolak, status request berubah menjadi `REJECTED`, `rejectionReason` disimpan, dan `respondedAt` diisi.
10. Operasi dilakukan dalam transaksi. Listing dikunci lebih dahulu, lalu request dikunci, untuk menjaga urutan lock yang konsisten pada operasi stok.
11. Setelah respons berhasil, sistem mencoba mengirim notifikasi kepada receiver: `REQUEST_APPROVED` atau `REQUEST_REJECTED`.

Error yang dipetakan service:
| HTTP | Message |
|---:|---|
| 404 | `Food request not found` |
| 403 | `You are not authorized to respond to this request` |
| 409 | `This food request has already been processed` |
| 409 | `Listing is no longer available or has insufficient stock` |
| 500 | `Failed to respond to food request` |

`REQUEST_NOT_FOUND` dan `LISTING_NOT_FOUND` sama-sama dipetakan menjadi `Food request not found`.

### 4.5 Membatalkan permintaan

`PATCH /:id/cancel`

Role: `RECEIVER`

Path parameter:
- `id`: UUID food request.

Request body: tidak didefinisikan / tidak divalidasi oleh route.

Business rules:
1. Request harus ditemukan.
2. Pengguna harus merupakan recipient dari request tersebut.
3. Hanya request berstatus `PENDING` yang dapat dibatalkan.
4. Status berubah menjadi `CANCELLED`; `cancelledAt` dan `updatedAt` diisi.
5. Operasi dilakukan dalam transaksi dan row request dikunci (`FOR UPDATE`).

Error yang dipetakan service:
| HTTP | Message |
|---:|---|
| 404 | `Food request not found` |
| 403 | `You are not authorized to cancel this request` |
| 409 | `Only pending requests can be cancelled` |
| 500 | `Failed to cancel food request` |

### 4.6 Detail permintaan

`GET /:id`

Role route: `RECEIVER`, `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`, `ADMIN`

Path parameter:
- `id`: UUID food request.

Data yang diambil repository:
- `id`
- `recipientId`
- `listingId`
- `requestedPortions`
- `fulfillmentMethod`
- `recipientNotes`
- `status`
- `rejectionReason`
- `respondedAt`
- `cancelledAt`
- `completedAt`
- `createdAt`
- `updatedAt`
- `listingName`
- `donorId`
- `donorName`
- `categoryName`

Authorization tambahan pada service:
- Recipient request boleh melihat.
- Donor pemilik listing boleh melihat.
- `ADMIN` boleh melihat.
- Pengguna lain menerima 403.

Error:
| HTTP | Message |
|---:|---|
| 404 | `Food request not found` |
| 403 | `You are not authorized to view this food request` |

## 5. Validasi query dan parameter

### Query schema

```json
{
  "status": "PENDING",
  "page": "1",
  "limit": "20"
}
```

Catatan:
- `page` dan `limit` menggunakan coercion angka, sehingga nilai query string dapat dikonversi menjadi number.
- `page` integer minimal 1.
- `limit` integer minimal 1 dan maksimal 50.
- Query object strict.

Jika query tidak valid, route mengirim `AppError(400, "Invalid food request query parameters")`.

### Parameter schema

```json
{
  "id": "UUID"
}
```

Jika `id` tidak valid, route mengirim `AppError(400, "Invalid food request ID")`.

## 6. Alur status utama

```text
PENDING
  ├── Donor approve ──> APPROVED
  ├── Donor reject  ──> REJECTED
  └── Receiver cancel ─> CANCELLED
```

Source module ini hanya memperlihatkan transisi di atas. Status `IN_PROGRESS`, `COMPLETED`, `EXPIRED`, dan `FAILED` tercantum pada filter query, tetapi transisi status tersebut tidak diimplementasikan dalam source yang diberikan.

## 7. Contoh pengujian Bruno

Gunakan base URL dan token sesuai environment Bruno milik project. Path berikut relatif terhadap prefix router yang dipasang aplikasi.

### Create request

```http
POST {{baseUrl}}/food-requests
Authorization: Bearer {{receiverToken}}
Content-Type: application/json
```

```json
{
  "listingId": "{{listingId}}",
  "requestedPortions": 2,
  "fulfillmentMethod": "SELF_PICKUP",
  "recipientNotes": "Saya akan mengambil sore hari."
}
```

### Get my requests

```http
GET {{baseUrl}}/food-requests/me?page=1&limit=20&status=PENDING
Authorization: Bearer {{receiverToken}}
```

Untuk donor, gunakan `donorToken`; endpoint yang sama akan mengembalikan permintaan masuk milik donor.

### Get incoming requests

```http
GET {{baseUrl}}/food-requests/incoming?page=1&limit=20
Authorization: Bearer {{donorToken}}
```

### Get request detail

```http
GET {{baseUrl}}/food-requests/{{requestId}}
Authorization: Bearer {{receiverToken}}
```

### Approve request

```http
PATCH {{baseUrl}}/food-requests/{{requestId}}/respond
Authorization: Bearer {{donorToken}}
Content-Type: application/json
```

```json
{
  "action": "APPROVE"
}
```

### Reject request

```http
PATCH {{baseUrl}}/food-requests/{{requestId}}/respond
Authorization: Bearer {{donorToken}}
Content-Type: application/json
```

```json
{
  "action": "REJECT",
  "rejectionReason": "Stok sudah tidak tersedia."
}
```

### Cancel request

```http
PATCH {{baseUrl}}/food-requests/{{requestId}}/cancel
Authorization: Bearer {{receiverToken}}
```

## 8. Catatan implementasi dan hal yang perlu diverifikasi

1. **Controller belum disertakan.** Bentuk response sukses, HTTP status sukses, dan envelope response tidak dapat ditentukan dari routes/service/repository/validation/types saja.
2. **Prefix router belum terlihat.** Contoh Bruno menggunakan `/food-requests` sebagai asumsi prefix; sesuaikan dengan mount di API entry point.
3. **`ACTIVE_REQUEST_STATUSES` tidak digunakan** pada repository yang diberikan.
4. **Filter status mencakup status yang belum ditransisikan oleh module ini.** `IN_PROGRESS`, `COMPLETED`, `EXPIRED`, dan `FAILED` dapat dipakai sebagai filter, tetapi fungsi perubahan statusnya tidak ada pada source yang dikirim.
5. **Notifikasi bersifat safe.** Service memakai `createNotificationSafely`; kegagalan notifikasi tidak semestinya menggagalkan operasi request menurut maksud helper, tetapi implementasi helper tidak disertakan untuk diverifikasi.
6. **Konsistensi stok menggunakan row lock listing.** Create request dan respond request mengunci row listing. Approval mengurangi stok dalam transaksi yang sama dengan perubahan status request.
7. **Request `PENDING` tidak mengurangi stok.** Pengurangan `availablePortions` hanya dilakukan ketika donor melakukan `APPROVE`.
8. Error internal dari repository seperti `FOOD_REQUEST_APPROVAL_FAILED`, `FOOD_REQUEST_REJECTION_FAILED`, dan `FOOD_REQUEST_CANCELLATION_FAILED` tidak dipetakan secara eksplisit di service; penanganan akhirnya bergantung pada error handler global.

## 9. Source yang tercakup

- `food-requests.repository.ts`
- `food-requests.routes.ts`
- `food-requests.service.ts`
- `food-requests.types.ts`
- `food-requests.validation.ts`

Tidak terlihat pada source yang dikirim:
- `food-requests.controller.ts`
- router mount / API entry point
- implementasi global error handler
- implementasi `createNotificationSafely`
- schema database lengkap untuk `foodRequests` dan relasinya
