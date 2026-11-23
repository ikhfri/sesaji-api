# SESAJI API — Pickup Schedules Module

> Dokumentasi ini disusun berdasarkan source `src/modules/pickup-schedules/*` yang diberikan. Prefix mount router pada entry point aplikasi tidak disertakan; endpoint ditulis menggunakan prefix `/pickup-schedules` sesuai nama modul.

## 1. Ringkasan

Pickup Schedules Module mengelola jadwal pengambilan makanan untuk Food Request yang sudah disetujui (`APPROVED`).

Fitur yang tersedia:
- Donor membuat jadwal pengambilan untuk request yang sudah disetujui.
- Donor dan receiver melihat daftar jadwal miliknya.
- Donor, receiver terkait, atau admin melihat detail jadwal.
- Donor memperbarui jadwal.
- Donor menghapus jadwal.

Saat jadwal dibuat, sistem menghasilkan handover code 4 digit dan mengirim notifikasi internal kepada receiver.

## 2. Authentication dan role

Semua route dilindungi middleware `authenticate`.

| Operasi | Role yang diizinkan |
|---|---|
| `GET /me` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`, `RECEIVER` |
| `POST /` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` |
| `GET /:id` | Pemilik donor, receiver terkait, atau `ADMIN` |
| `PATCH /:id` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` |
| `DELETE /:id` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` |

Akses detail diperiksa di service berdasarkan relasi jadwal:
- Donor harus merupakan pemilik listing.
- Receiver harus merupakan pemilik food request.
- Admin dapat mengakses detail tanpa menjadi pemilik.

Untuk operasi create/update/delete, service juga memeriksa role donor.

## 3. Daftar endpoint

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/pickup-schedules/me` | Mengambil daftar jadwal milik user |
| POST | `/pickup-schedules` | Membuat jadwal pengambilan |
| GET | `/pickup-schedules/:id` | Mengambil detail jadwal |
| PATCH | `/pickup-schedules/:id` | Memperbarui jadwal |
| DELETE | `/pickup-schedules/:id` | Menghapus jadwal |

## 4. Detail endpoint

### 4.1 GET `/pickup-schedules/me`

Mengambil semua jadwal yang terkait dengan user yang sedang login.

**Role:** `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`, `RECEIVER`.

**Contoh request**

```http
GET /pickup-schedules/me
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Pickup schedules retrieved successfully",
  "data": [
    {
      "id": "schedule-uuid",
      "requestId": "request-uuid",
      "scheduledStartAt": "2026-11-24T09:00:00.000Z",
      "scheduledEndAt": "2026-11-24T10:00:00.000Z",
      "handoverCode": "0427",
      "notes": "Ambil melalui gerbang utama",
      "createdAt": "2026-11-23T10:00:00.000Z",
      "updatedAt": "2026-11-23T10:00:00.000Z",
      "listingId": "listing-uuid",
      "listingName": "Paket makanan",
      "donorId": "donor-uuid",
      "recipientId": "receiver-uuid"
    }
  ]
}
```

Contoh record di atas menggambarkan field yang dipilih repository. Nilai dan format timestamp mengikuti data aktual database.

**Perilaku data**
- Untuk role donor (`DONOR_INDIVIDUAL` atau `DONOR_BUSINESS`), hasil difilter berdasarkan `foodListings.donorId`.
- Untuk role receiver, hasil difilter berdasarkan `foodRequests.recipientId`.
- Hasil diurutkan berdasarkan `scheduledStartAt` descending (jadwal paling baru lebih dahulu).
- Repository melakukan inner join jadwal dengan food request dan food listing.

### 4.2 POST `/pickup-schedules`

Membuat jadwal pengambilan untuk Food Request.

**Role:** `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`.

**Request body**

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `requestId` | UUID | Ya | UUID valid |
| `scheduledStartAt` | string datetime | Ya | ISO datetime dengan timezone/offset |
| `scheduledEndAt` | string datetime | Ya | ISO datetime dengan timezone/offset; harus setelah waktu mulai |
| `notes` | string atau `null` | Tidak | Di-trim, maksimal 2000 karakter |

Body bersifat strict; field tambahan ditolak.

**Contoh request**

```http
POST /pickup-schedules
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "scheduledStartAt": "2026-11-24T09:00:00+07:00",
  "scheduledEndAt": "2026-11-24T10:00:00+07:00",
  "notes": "Ambil melalui gerbang utama"
}
```

**Response sukses — HTTP 201**

```json
{
  "success": true,
  "message": "Pickup schedule created successfully",
  "data": {
    "id": "schedule-uuid",
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "scheduledStartAt": "2026-11-24T02:00:00.000Z",
    "scheduledEndAt": "2026-11-24T03:00:00.000Z",
    "handoverCode": "0427",
    "notes": "Ambil melalui gerbang utama",
    "createdAt": "2026-11-23T10:00:00.000Z",
    "updatedAt": "2026-11-23T10:00:00.000Z"
  }
}
```

Response `data` merupakan row hasil insert; contoh hanya ilustrasi. Penyimpanan Date dapat tampil dalam format UTC pada JSON.

**Aturan bisnis saat create**
1. Request harus ditemukan dan listing terkait harus dimiliki donor yang sedang login.
2. Status request harus `APPROVED`.
3. `scheduledEndAt` tidak boleh melewati `foodListings.pickupDeadline`.
4. Satu request hanya boleh memiliki satu pickup schedule.
5. Jadwal dibuat dalam transaksi database dengan row lock pada food request.
6. Handover code dibuat server-side menggunakan angka acak 0–9999 dan dipadatkan menjadi 4 digit (termasuk leading zero).
7. Setelah jadwal berhasil dibuat, sistem memanggil `createNotificationSafely` untuk receiver:
   - `type`: `SYSTEM`
   - `title`: `Jadwal pengambilan tersedia`
   - `body`: `Donor telah mengatur jadwal pengambilan makanan untuk permintaanmu.`
   - `data`: `scheduleId` dan `requestId`

**Error bisnis**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Food request tidak ditemukan atau bukan milik donor | 404 | `Food request not found` |
| Request belum berstatus `APPROVED` | 409 | `Pickup schedule can only be created for approved requests` |
| Jadwal melewati pickup deadline listing | 422 | `Pickup schedule cannot exceed the listing pickup deadline` |
| Jadwal untuk request sudah ada | 409 | `Pickup schedule already exists for this request` |
| Insert tidak menghasilkan data | 500 | `Failed to create pickup schedule` |
| Role bukan donor | 403 | `Only donors can create pickup schedules` |

### 4.3 GET `/pickup-schedules/:id`

Mengambil detail satu pickup schedule.

**Akses:** donor pemilik listing, receiver pemilik request, atau admin.

**Path parameter**

| Parameter | Tipe | Validasi |
|---|---|---|
| `id` | UUID | UUID valid |

**Contoh request**

```http
GET /pickup-schedules/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Pickup schedule retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "requestId": "request-uuid",
    "scheduledStartAt": "2026-11-24T09:00:00.000Z",
    "scheduledEndAt": "2026-11-24T10:00:00.000Z",
    "handoverCode": "0427",
    "notes": "Ambil melalui gerbang utama",
    "createdAt": "2026-11-23T10:00:00.000Z",
    "updatedAt": "2026-11-23T10:00:00.000Z",
    "recipientId": "receiver-uuid",
    "donorId": "donor-uuid",
    "listingId": "listing-uuid",
    "listingName": "Paket makanan",
    "recipientName": "Nama Receiver"
  }
}
```

Repository mengambil detail dengan join ke `foodRequests`, `foodListings`, dan `users`. Field di atas mengikuti proyeksi select repository.

**Error**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Jadwal tidak ditemukan | 404 | `Pickup schedule not found` |
| User bukan admin, donor pemilik, atau receiver terkait | 403 | `You are not allowed to access this pickup schedule` |
| ID bukan UUID valid | 400 | `Invalid pickup schedule ID` |

### 4.4 PATCH `/pickup-schedules/:id`

Memperbarui jadwal pengambilan. Hanya donor (`DONOR_INDIVIDUAL` atau `DONOR_BUSINESS`) yang dapat melakukannya, dan donor harus pemilik listing terkait.

**Path parameter:** `id` harus UUID valid.

**Request body**

Semua field bersifat opsional, tetapi minimal satu field harus dikirim.

| Field | Tipe | Validasi |
|---|---|---|
| `scheduledStartAt` | string datetime | ISO datetime dengan timezone/offset |
| `scheduledEndAt` | string datetime | ISO datetime dengan timezone/offset |
| `notes` | string atau `null` | Di-trim, maksimal 2000 karakter |

Body strict. Field kosong `{}` ditolak dengan pesan validasi `At least one field must be provided`.

**Contoh request**

```http
PATCH /pickup-schedules/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "scheduledStartAt": "2026-11-24T10:00:00+07:00",
  "scheduledEndAt": "2026-11-24T11:00:00+07:00",
  "notes": "Ambil di pos keamanan"
}
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Pickup schedule updated successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "requestId": "request-uuid",
    "scheduledStartAt": "2026-11-24T03:00:00.000Z",
    "scheduledEndAt": "2026-11-24T04:00:00.000Z",
    "handoverCode": "0427",
    "notes": "Ambil di pos keamanan",
    "updatedAt": "2026-11-23T11:00:00.000Z"
  }
}
```

`data` adalah row hasil update; contoh hanya ilustrasi dan bukan daftar kolom lengkap.

**Aturan update**
- Jadwal harus ditemukan dan terkait dengan listing milik donor yang login.
- Food request harus tetap berstatus `APPROVED`.
- Jika hanya salah satu waktu dikirim, waktu lainnya menggunakan nilai yang tersimpan.
- Waktu akhir harus setelah waktu mulai.
- Waktu akhir tidak boleh melewati pickup deadline listing.
- Hanya field yang dikirim yang diperbarui; `updatedAt` selalu diperbarui.
- Operasi menggunakan transaksi dan row lock pada pickup schedule.

**Error bisnis**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Jadwal tidak ditemukan atau bukan milik donor | 404 | `Pickup schedule not found` |
| Request tidak ditemukan atau bukan lagi `APPROVED` | 409 | `Pickup schedule cannot be changed because the request is no longer approved` |
| Waktu akhir tidak setelah waktu mulai | 422 | `Scheduled end time must be after start time` |
| Jadwal melewati pickup deadline | 422 | `Pickup schedule cannot exceed the listing pickup deadline` |
| Update tidak menghasilkan data | 500 | `Failed to update pickup schedule` |
| Role bukan donor | 403 | `Only donors can update pickup schedules` |

### 4.5 DELETE `/pickup-schedules/:id`

Menghapus pickup schedule. Hanya donor (`DONOR_INDIVIDUAL` atau `DONOR_BUSINESS`) yang merupakan pemilik listing terkait yang dapat menghapus.

**Path parameter:** `id` harus UUID valid.

**Contoh request**

```http
DELETE /pickup-schedules/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Pickup schedule deleted successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Aturan delete**
- Jadwal harus ditemukan dan terkait dengan listing milik donor yang login.
- Food request harus masih berstatus `APPROVED`.
- Penghapusan dilakukan secara fisik (`DELETE FROM pickupSchedules`) di dalam transaksi.

**Error bisnis**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Jadwal tidak ditemukan atau bukan milik donor | 404 | `Pickup schedule not found` |
| Request tidak ditemukan atau bukan lagi `APPROVED` | 409 | `Pickup schedule cannot be deleted because the request is no longer approved` |
| Role bukan donor | 403 | `Only donors can delete pickup schedules` |

## 5. Validasi parameter ID

Semua route `/:id` menjalankan `pickupScheduleParamsSchema`:
- `id` harus UUID valid.
- Jika gagal, route mengembalikan HTTP 400 dengan message `Invalid pickup schedule ID`.
- `errors` berisi array `result.error.issues` dari Zod.

Contoh bentuk response:

```json
{
  "success": false,
  "message": "Invalid pickup schedule ID",
  "errors": [
    {
      "origin": "string",
      "code": "invalid_format",
      "format": "uuid",
      "path": ["id"],
      "message": "Invalid UUID"
    }
  ]
}
```

Detail issue dapat berbeda sesuai error yang dihasilkan Zod.

## 6. Contoh pengujian di Bruno

Gunakan environment variable `baseUrl`, `token`, `requestId`, dan `scheduleId`.

**Get my schedules**

```http
GET {{baseUrl}}/pickup-schedules/me
Authorization: Bearer {{token}}
```

**Create schedule**

```http
POST {{baseUrl}}/pickup-schedules
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "requestId": "{{requestId}}",
  "scheduledStartAt": "2026-11-24T09:00:00+07:00",
  "scheduledEndAt": "2026-11-24T10:00:00+07:00",
  "notes": "Ambil melalui gerbang utama"
}
```

**Get schedule detail**

```http
GET {{baseUrl}}/pickup-schedules/{{scheduleId}}
Authorization: Bearer {{token}}
```

**Update schedule**

```http
PATCH {{baseUrl}}/pickup-schedules/{{scheduleId}}
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "scheduledStartAt": "2026-11-24T10:00:00+07:00",
  "scheduledEndAt": "2026-11-24T11:00:00+07:00",
  "notes": "Ambil di pos keamanan"
}
```

**Delete schedule**

```http
DELETE {{baseUrl}}/pickup-schedules/{{scheduleId}}
Authorization: Bearer {{token}}
```

## 7. Catatan implementasi dan batas dokumentasi

- Controller menetapkan HTTP 201 untuk create dan HTTP 200 untuk list, detail, update, serta delete.
- Prefix `/pickup-schedules` mengikuti nama modul; mount path aktual pada entry point belum disertakan.
- Tidak ada endpoint untuk receiver membuat, mengubah, atau menghapus jadwal.
- Handover code dihasilkan server-side sebagai string 4 digit. Source yang diberikan belum menunjukkan endpoint verifikasi handover code.
- Pembuatan jadwal mengirim notifikasi ke receiver menggunakan `createNotificationSafely`; kegagalan notifikasi ditangani oleh helper tersebut.
- Validasi waktu memakai ISO datetime dengan offset. Batas pickup deadline diperiksa lagi di repository.
- Source schema database, middleware `authenticate`, `authorize`, `validate`, dan error handler global tidak disertakan. Detail internal yang tidak tampak pada source tersebut tidak diasumsikan.
