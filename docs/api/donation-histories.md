# Dokumentasi API — Donation Histories Module

Dokumentasi ini disusun berdasarkan source code pada `src/modules/donation-histories/`.

## 1. Ringkasan

Donation Histories menyediakan riwayat permintaan donasi makanan (food requests) yang dapat diakses oleh donor, receiver, volunteer, dan admin sesuai hak akses masing-masing.

Module ini hanya menyediakan endpoint untuk:
- Mengambil daftar riwayat milik atau yang terkait dengan pengguna yang sedang login.
- Mengambil detail satu riwayat berdasarkan ID request.

Data dibaca dari `public.donation_histories`. Pada source yang diperiksa, module ini tidak menyediakan endpoint untuk membuat, mengubah, atau menghapus riwayat.

## 2. Autentikasi dan otorisasi

Semua route menggunakan middleware `authenticate`.

Role yang diizinkan pada kedua endpoint:
- `DONOR_INDIVIDUAL`
- `DONOR_BUSINESS`
- `RECEIVER`
- `VOLUNTEER`
- `ADMIN`

Service juga memeriksa role melalui `assertAllowedRole`. Jika role tidak termasuk daftar tersebut, service melempar `403` dengan pesan:

```json
{
  "message": "You are not allowed to access donation histories"
}
```

Batas data berdasarkan role diterapkan di repository:

| Role | Kondisi akses |
|---|---|
| `DONOR_INDIVIDUAL` | `donor_id = userId` |
| `DONOR_BUSINESS` | `donor_id = userId` |
| `RECEIVER` | `recipient_id = userId` |
| `VOLUNTEER` | `volunteer_id = userId` |
| `ADMIN` | `TRUE` — seluruh riwayat |

Role selain yang dikenali menghasilkan kondisi `FALSE` pada repository.

## 3. Endpoint

Prefix mount router tidak terlihat pada source yang diberikan. Path di bawah adalah path relatif terhadap router module.

### 3.1 Mengambil daftar riwayat sendiri

`GET /me`

Mengambil daftar riwayat donasi yang dapat diakses oleh pengguna berdasarkan role yang sedang login.

**Middleware**
1. `authenticate`
2. `authorize(...historyRoles)`
3. `validateQuery(donationHistoryQuerySchema)`

**Query parameters**

| Parameter | Tipe | Default | Aturan |
|---|---|---:|---|
| `page` | number | `1` | Integer, minimal 1 |
| `limit` | number | `10` | Integer, minimal 1, maksimal 50 |
| `status` | string | — | Opsional, harus salah satu status yang tercantum di bawah |

Nilai `status` yang diterima:
- `PENDING`
- `APPROVED`
- `REJECTED`
- `CANCELLED`
- `EXPIRED`
- `IN_PROGRESS`
- `COMPLETED`
- `FAILED`

`page` dan `limit` menggunakan `z.coerce.number()`, sehingga nilai query string dikonversi menjadi number sebelum divalidasi.

**Contoh request**

```http
GET /me?page=1&limit=10&status=COMPLETED
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Donation histories retrieved successfully",
  "data": [
    {
      "requestId": "uuid",
      "listingId": "uuid",
      "foodName": "Nama makanan",
      "categoryName": "Nama kategori",
      "donorId": "uuid",
      "donorName": "Nama donor",
      "donorType": "DONOR_INDIVIDUAL",
      "businessName": null,
      "recipientId": "uuid",
      "recipientName": "Nama penerima",
      "institutionName": null,
      "institutionType": null,
      "requestedPortions": 5,
      "fulfillmentMethod": "PICKUP",
      "requestStatus": "COMPLETED",
      "scheduledStartAt": null,
      "scheduledEndAt": null,
      "deliveryTaskId": null,
      "volunteerId": null,
      "volunteerName": null,
      "deliveryTaskStatus": null,
      "requestedAt": "2026-01-01T10:00:00.000Z",
      "respondedAt": null,
      "completedAt": "2026-01-02T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 1,
    "totalPages": 1
  }
}
```

Contoh di atas menggambarkan struktur field dari type `DonationHistory`; nilai dan timestamp hanya ilustrasi, bukan data tetap dari API.

**Perilaku query**
- Filter role diterapkan pada `donor_id`, `recipient_id`, atau `volunteer_id`; admin tidak dibatasi oleh user ID.
- Jika `status` dikirim, query menambahkan filter `request_status`.
- Hasil diurutkan berdasarkan `requested_at DESC`, kemudian `request_id DESC`.
- Pagination menggunakan `LIMIT` dan `OFFSET`.
- Total data dihitung melalui query `COUNT(*)` dengan kondisi akses dan filter status yang sama.
- `totalPages` dihitung dengan `Math.ceil(totalItems / limit)`.

### 3.2 Mengambil detail riwayat

`GET /:id`

Mengambil satu riwayat berdasarkan `request_id`.

**Middleware**
1. `authenticate`
2. `authorize(...historyRoles)`
3. `validateHistoryId`

Parameter `id` harus berupa UUID. Jika tidak valid, route mengembalikan HTTP 400:

```json
{
  "success": false,
  "message": "Invalid donation history ID",
  "errors": []
}
```

`errors` berisi issue validasi Zod yang sebenarnya; array kosong di atas hanya placeholder contoh.

**Contoh request**

```http
GET /550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Donation history retrieved successfully",
  "data": {
    "requestId": "uuid",
    "listingId": "uuid",
    "foodName": "Nama makanan",
    "categoryName": "Nama kategori",
    "donorId": "uuid",
    "donorName": "Nama donor",
    "donorType": "DONOR_INDIVIDUAL",
    "businessName": null,
    "recipientId": "uuid",
    "recipientName": "Nama penerima",
    "institutionName": null,
    "institutionType": null,
    "requestedPortions": 5,
    "fulfillmentMethod": "PICKUP",
    "requestStatus": "COMPLETED",
    "scheduledStartAt": null,
    "scheduledEndAt": null,
    "deliveryTaskId": null,
    "volunteerId": null,
    "volunteerName": null,
    "deliveryTaskStatus": null,
    "requestedAt": "2026-01-01T10:00:00.000Z",
    "respondedAt": null,
    "completedAt": "2026-01-02T10:00:00.000Z"
  }
}
```

Contoh di atas menunjukkan bentuk data sesuai interface `DonationHistory`; nilai hanya ilustrasi.

Jika riwayat tidak ditemukan atau tidak dapat diakses oleh role/user tersebut, service melempar HTTP 404 dengan pesan `Donation history not found`.

## 4. Struktur data `DonationHistory`

| Field | Tipe | Keterangan berdasarkan nama field |
|---|---|---|
| `requestId` | `string` | ID food request |
| `listingId` | `string` | ID food listing |
| `foodName` | `string` | Nama makanan |
| `categoryName` | `string \| null` | Nama kategori |
| `donorId` | `string` | ID donor |
| `donorName` | `string` | Nama donor |
| `donorType` | `string \| null` | Tipe donor |
| `businessName` | `string \| null` | Nama bisnis |
| `recipientId` | `string` | ID penerima |
| `recipientName` | `string` | Nama penerima |
| `institutionName` | `string \| null` | Nama institusi |
| `institutionType` | `string \| null` | Tipe institusi |
| `requestedPortions` | `number` | Jumlah porsi yang diminta |
| `fulfillmentMethod` | `string \| null` | Metode pemenuhan |
| `requestStatus` | `string` | Status food request |
| `scheduledStartAt` | `Date \| null` | Waktu mulai jadwal |
| `scheduledEndAt` | `Date \| null` | Waktu akhir jadwal |
| `deliveryTaskId` | `string \| null` | ID delivery task |
| `volunteerId` | `string \| null` | ID volunteer |
| `volunteerName` | `string \| null` | Nama volunteer |
| `deliveryTaskStatus` | `string \| null` | Status delivery task |
| `requestedAt` | `Date` | Waktu request dibuat |
| `respondedAt` | `Date \| null` | Waktu request direspons |
| `completedAt` | `Date \| null` | Waktu request selesai |

Field tanggal bertipe `Date` pada TypeScript. Saat dikirim sebagai JSON, serialisasi tanggal mengikuti perilaku JSON/JavaScript.

## 5. Contoh error yang diketahui dari source

| HTTP | Kondisi | Pesan |
|---:|---|---|
| 400 | ID route tidak valid | `Invalid donation history ID` |
| 403 | Role tidak diizinkan oleh service | `You are not allowed to access donation histories` |
| 404 | Riwayat tidak ditemukan atau tidak dapat diakses | `Donation history not found` |

Bentuk response untuk error yang dilempar melalui `AppError` bergantung pada global error handler dan tidak dapat dipastikan dari source module ini saja.

## 6. Catatan implementasi

- `GET /me` dan `GET /:id` sama-sama memerlukan autentikasi.
- Daftar role pada middleware route dan service konsisten.
- Pembatasan akses detail tidak hanya berdasarkan ID; query detail juga menambahkan kondisi akses sesuai role.
- Untuk admin, kondisi akses repository adalah `TRUE`, sehingga admin dapat membaca seluruh baris pada view/table `public.donation_histories`.
- Repository membaca `public.donation_histories` melalui SQL langsung menggunakan `db.execute`.
- Source module tidak memperlihatkan definisi view/table `public.donation_histories`; asal pembentukan kolom dan relasinya belum dapat dijelaskan dari file module ini.

## 7. Batas dokumentasi

Dokumentasi ini mencakup controller, repository, routes, service, types, dan validation yang tersedia pada source yang diberikan. Hal-hal berikut tidak terlihat dari source tersebut:
- Prefix router saat dipasang ke aplikasi Express.
- Definisi SQL/schema dari `public.donation_histories`.
- Format global error response untuk `AppError`.
- Contoh data aktual dari database.

