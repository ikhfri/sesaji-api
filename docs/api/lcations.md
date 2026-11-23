# SESAJI API — Locations Module

> Dokumentasi ini dibuat berdasarkan source `src/modules/locations/` yang diberikan. Contoh ID, koordinat, dan data response di bawah bersifat ilustratif. Prefix mount router dan format error global belum dapat dipastikan dari module ini saja.

## 1. Ringkasan

Locations module mengelola lokasi yang dimiliki/terhubung dengan pengguna yang sedang login. Seluruh endpoint dilindungi middleware `authenticate`.

| Method | Endpoint | Fungsi | Success status |
|---|---|---|---:|
| GET | `/locations/me` | Mengambil semua lokasi milik user | 200 |
| POST | `/locations/me` | Menambahkan lokasi baru | 201 |
| PATCH | `/locations/me/:id` | Memperbarui lokasi | 200 |
| PATCH | `/locations/me/:id/default` | Menjadikan lokasi sebagai default | 200 |
| DELETE | `/locations/me/:id` | Menghapus lokasi | 200 |

Path mengasumsikan router dipasang dengan prefix `/locations`. Prefix API final perlu dicocokkan dengan entry point aplikasi.

## 2. Autentikasi dan kepemilikan data

- `authenticate` dipasang di level router (`router.use(authenticate)`), sehingga semua endpoint membutuhkan autentikasi.
- User ID diambil dari `req.auth.userId`.
- Operasi update, set default, dan delete membatasi pencarian berdasarkan pasangan `userLocations.id` dan `userLocations.userId`.
- User tidak dapat mengubah/menghapus relasi lokasi milik user lain melalui ID relasi tersebut.

Contoh header (sesuaikan dengan implementasi Auth):

```http
Authorization: Bearer <access_token>
```

## 3. Model data response

Response lokasi menggunakan data gabungan dari `userLocations` dan `locations`.

| Field | Asal | Keterangan |
|---|---|---|
| `id` | `userLocations.id` | ID relasi user dengan lokasi; digunakan sebagai `:id` pada endpoint update/default/delete |
| `locationId` | `locations.id` | ID record lokasi |
| `locationType` | `userLocations.locationType` | Jenis penggunaan lokasi |
| `isDefault` | `userLocations.isDefault` | Penanda lokasi default |
| `address` | `locations.address` | Alamat |
| `latitude` | `locations.latitude` | Latitude |
| `longitude` | `locations.longitude` | Longitude |
| `postalCode` | `locations.postalCode` | Kode pos |
| `label` | `locations.label` | Label lokasi |
| `createdAt` | `userLocations.createdAt` | Waktu pembuatan relasi |

Penting: parameter `:id` adalah `userLocations.id`, bukan `locationId`.

## 4. GET `/locations/me`

Mengambil seluruh lokasi yang terhubung dengan user yang sedang login.

### Request

Tidak memerlukan request body atau path parameter.

```http
GET /locations/me
Authorization: Bearer <access_token>
```

### Response sukses — 200

```json
{
  "success": true,
  "message": "Locations retrieved successfully",
  "data": [
    {
      "id": "user-location-uuid",
      "locationId": "location-uuid",
      "locationType": "PICKUP",
      "isDefault": true,
      "address": "Jl. Contoh No. 10, Depok",
      "latitude": -6.4025,
      "longitude": 106.7942,
      "postalCode": "16431",
      "label": "Rumah",
      "createdAt": "2026-11-23T08:00:00.000Z"
    }
  ]
}
```

`data` adalah array; jika user belum mempunyai lokasi, repository akan menghasilkan array kosong. Tidak ada sorting eksplisit pada query.

## 5. POST `/locations/me`

Membuat record lokasi dan relasi lokasi ke user dalam satu transaksi database.

### Request body

```json
{
  "address": "Jl. Contoh No. 10, Depok",
  "latitude": -6.4025,
  "longitude": 106.7942,
  "postalCode": "16431",
  "label": "Rumah",
  "locationType": "PICKUP",
  "isDefault": true
}
```

### Validasi

| Field | Tipe | Wajib | Aturan |
|---|---|---:|---|
| `address` | string | Ya | Di-trim; 5–2000 karakter |
| `latitude` | number | Ya | -90 sampai 90 |
| `longitude` | number | Ya | -180 sampai 180 |
| `postalCode` | string | Tidak | Di-trim; maksimal 20 karakter |
| `label` | string | Tidak | Di-trim; maksimal 100 karakter |
| `locationType` | string | Ya | Di-trim; 2–100 karakter |
| `isDefault` | boolean | Tidak | Jika tidak dikirim, nilainya diperlakukan sebagai false sebelum aturan default diterapkan |

Object bersifat `.strict()`, sehingga field tambahan di luar schema ditolak.

### Aturan default location

Implementasi repository:
1. Mengunci row user menggunakan `SELECT ... FOR UPDATE` dalam transaksi.
2. Memeriksa apakah user sudah memiliki lokasi default.
3. Lokasi baru menjadi default jika `isDefault: true` dikirim **atau** belum ada lokasi default.
4. Jika lokasi baru menjadi default, semua relasi lokasi user tersebut diubah menjadi `isDefault: false` terlebih dahulu.
5. Lokasi dan relasi user-location dibuat dalam transaksi yang sama.
6. Jika menjadi default, `defaultUserLocationId` pada `donorProfiles` dan `receiverProfiles` milik user disinkronkan dengan ID relasi user-location yang baru.

Dengan demikian, lokasi pertama user otomatis menjadi default meskipun request tidak menyertakan `isDefault: true`.

### Response sukses — 201

```json
{
  "success": true,
  "message": "Location created successfully",
  "data": {
    "id": "user-location-uuid",
    "locationId": "location-uuid",
    "locationType": "PICKUP",
    "isDefault": true,
    "address": "Jl. Contoh No. 10, Depok",
    "latitude": -6.4025,
    "longitude": 106.7942,
    "postalCode": "16431",
    "label": "Rumah",
    "createdAt": "2026-11-23T08:00:00.000Z"
  }
}
```

### Error / kondisi gagal

Repository dapat melempar error internal:
- `LOCATION_CREATION_FAILED`
- `USER_LOCATION_CREATION_FAILED`

Kedua error tersebut bukan `AppError` pada module ini. HTTP status dan format response yang dikirim untuk error tersebut bergantung pada global error handler, sehingga tidak dapat dipastikan hanya dari source Locations.

## 6. PATCH `/locations/me/:id`

Memperbarui field lokasi atau jenis penggunaan lokasi. `:id` adalah ID relasi `userLocations.id`.

### Request body

Contoh mengubah alamat dan koordinat:

```json
{
  "address": "Jl. Baru No. 20, Depok",
  "latitude": -6.401,
  "longitude": 106.795
}
```

Contoh mengubah tipe lokasi:

```json
{
  "locationType": "DELIVERY"
}
```

Contoh menghapus kode pos dan label:

```json
{
  "postalCode": null,
  "label": null
}
```

### Validasi

| Field | Tipe | Wajib | Aturan |
|---|---|---:|---|
| `address` | string | Tidak | Di-trim; 5–2000 karakter |
| `latitude` | number | Tidak | -90 sampai 90 |
| `longitude` | number | Tidak | -180 sampai 180 |
| `postalCode` | string atau `null` | Tidak | Jika string, di-trim; maksimal 20 karakter |
| `label` | string atau `null` | Tidak | Jika string, di-trim; maksimal 100 karakter |
| `locationType` | string | Tidak | Di-trim; 2–100 karakter |

Ketentuan:
- Object strict; field tambahan ditolak.
- Minimal satu key harus dikirim.
- `postalCode: null` dan `label: null` dapat digunakan untuk mengosongkan nilai.
- `address`, `latitude`, `longitude`, dan `locationType` tidak menerima `null` menurut schema.
- Tidak ada field `isDefault` pada schema update; gunakan endpoint khusus default.

### Response sukses — 200

```json
{
  "success": true,
  "message": "Location updated successfully",
  "data": {
    "id": "user-location-uuid",
    "locationId": "location-uuid",
    "locationType": "PICKUP",
    "isDefault": false,
    "address": "Jl. Baru No. 20, Depok",
    "latitude": -6.401,
    "longitude": 106.795,
    "postalCode": "16431",
    "label": "Rumah",
    "createdAt": "2026-11-23T08:00:00.000Z"
  }
}
```

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 404 | `Location not found` | ID relasi lokasi tidak ditemukan atau bukan milik user yang login |

Service melakukan pengecekan kepemilikan sebelum update dan repository juga membatasi update berdasarkan user ID.

## 7. PATCH `/locations/me/:id/default`

Menjadikan lokasi tertentu sebagai lokasi default user.

### Request

Tidak memerlukan body.

```http
PATCH /locations/me/user-location-uuid/default
Authorization: Bearer <access_token>
```

### Response sukses — 200

Controller mengembalikan object lokasi relasi yang diperbarui:

```json
{
  "success": true,
  "message": "Default location updated successfully",
  "data": {
    "id": "user-location-uuid",
    "userId": "user-uuid",
    "locationId": "location-uuid",
    "locationType": "PICKUP",
    "isDefault": true,
    "address": "Jl. Contoh No. 10, Depok",
    "latitude": -6.4025,
    "longitude": 106.7942,
    "postalCode": "16431",
    "label": "Rumah",
    "createdAt": "2026-11-23T08:00:00.000Z"
  }
}
```

Perhatikan bahwa response endpoint ini berbeda dari response GET/update: hasil `findUserLocation` menyertakan `userId`.

### Aturan bisnis

1. Lokasi harus ditemukan dan dimiliki user yang login.
2. Jika lokasi sudah default, service langsung mengembalikan lokasi tersebut tanpa menjalankan perubahan.
3. Jika belum default, dalam transaksi repository semua lokasi user diubah menjadi non-default, lalu target diubah menjadi default.
4. `defaultUserLocationId` pada `donorProfiles` dan `receiverProfiles` disinkronkan dengan ID relasi user-location target.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 404 | `Location not found` | Lokasi tidak ditemukan atau bukan milik user |

## 8. DELETE `/locations/me/:id`

Menghapus relasi lokasi dari akun user.

### Request

```http
DELETE /locations/me/user-location-uuid
Authorization: Bearer <access_token>
```

Tidak memerlukan request body.

### Response sukses — 200

Controller membentuk response dengan `success: true` dan menyebarkan hasil service:

```json
{
  "success": true,
  "id": "user-location-uuid",
  "message": "Location deleted successfully"
}
```

### Aturan bisnis

- Lokasi harus ditemukan dan dimiliki user yang login.
- Lokasi default tidak boleh dihapus.
- User harus menetapkan lokasi lain sebagai default terlebih dahulu, baru menghapus lokasi sebelumnya.
- Repository menghapus row dari `userLocations`; source ini tidak melakukan penghapusan eksplisit row pada tabel `locations`.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 404 | `Location not found` | Lokasi tidak ditemukan atau bukan milik user |
| 409 | `Cannot delete the default location. Set another location as default first.` | Lokasi yang akan dihapus masih menjadi default |

## 9. Contoh request Bruno

Environment:

```text
baseUrl = http://localhost:3000
accessToken = <access-token>
```

Header untuk seluruh request:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

Sesuaikan `baseUrl` dengan server dan prefix API aktual.

### Get locations

```http
GET {{baseUrl}}/locations/me
Authorization: Bearer {{accessToken}}
```

### Create location

```http
POST {{baseUrl}}/locations/me
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "address": "Jl. Contoh No. 10, Depok",
  "latitude": -6.4025,
  "longitude": 106.7942,
  "postalCode": "16431",
  "label": "Rumah",
  "locationType": "PICKUP"
}
```

Request di atas tidak menyertakan `isDefault`; jika user belum punya lokasi default, lokasi ini otomatis menjadi default.

### Update location

```http
PATCH {{baseUrl}}/locations/me/{{userLocationId}}
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "address": "Jl. Baru No. 20, Depok",
  "label": "Rumah Baru"
}
```

### Set default location

```http
PATCH {{baseUrl}}/locations/me/{{userLocationId}}/default
Authorization: Bearer {{accessToken}}
```

### Delete location

```http
DELETE {{baseUrl}}/locations/me/{{userLocationId}}
Authorization: Bearer {{accessToken}}
```

## 10. Catatan implementasi dan hal yang perlu diverifikasi

1. `:id` pada route adalah ID relasi `userLocations`, bukan ID tabel `locations`.
2. Hanya donor dan receiver profiles yang disinkronkan melalui `defaultUserLocationId`. Tidak ada sinkronisasi ke `volunteerProfiles` pada source ini.
3. Penghapusan hanya menghapus relasi `userLocations`; tidak ada delete eksplisit terhadap record `locations` pada repository ini. Perilaku foreign key/cascade perlu dicek di schema database.
4. `locationType` divalidasi sebagai string umum 2–100 karakter, bukan enum Zod pada module ini.
5. `getMyLocations` tidak memiliki sorting eksplisit.
6. `createLocation` menangkap error lalu melemparkannya kembali tanpa pemetaan ke `AppError`.
7. Error dari middleware autentikasi, validasi, dan error handler global belum dapat didokumentasikan format HTTP/body-nya tanpa source middleware terkait.
8. Prefix mount dan base URL final perlu diverifikasi dari entry point aplikasi.
