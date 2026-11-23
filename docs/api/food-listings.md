# SESAJI API — Food Listings Module

> Disusun dari source `src/modules/food-listings/` yang tersedia pada lampiran. **File `food-listings.controller.ts` tidak terdapat dalam source yang dikirim.** Karena itu, dokumentasi ini dapat memastikan route, middleware, validasi, service, repository, dan error `AppError`, tetapi tidak mengklaim status HTTP sukses atau envelope JSON controller yang belum terlihat.

## 1. Ringkasan endpoint

Dengan asumsi router dipasang pada prefix `/food-listings`:

| Method | Endpoint | Akses | Tujuan |
|---|---|---|---|
| GET | `/food-listings/explore` | Public | Menjelajahi listing aktif dengan filter dan pagination |
| GET | `/food-listings/categories` | Public | Mengambil kategori makanan aktif |
| GET | `/food-listings/:id` | Public | Mengambil detail satu listing beserta images |
| GET | `/food-listings/me` | Donor | Mengambil listing milik donor yang login |
| POST | `/food-listings` | Donor | Membuat listing makanan |
| PATCH | `/food-listings/:id` | Donor | Memperbarui listing milik donor |
| DELETE | `/food-listings/:id` | Donor | Menutup listing milik donor |

Role donor yang diizinkan oleh route:
- `DONOR_INDIVIDUAL`
- `DONOR_BUSINESS`

Route public tidak memasang autentikasi. Setelah tiga route public, router memasang `authenticate`, sehingga route berikutnya memerlukan login.

## 2. Autentikasi dan otorisasi

- `GET /explore`, `GET /categories`, dan `GET /:id` bersifat public.
- `GET /me`, `POST /`, `PATCH /:id`, dan `DELETE /:id` memerlukan `authenticate`.
- Keempat endpoint donor menggunakan `authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS")`.
- Service create juga memeriksa role donor.
- Update dan close membatasi listing berdasarkan pasangan `listingId` dan `donorId`, sehingga donor hanya dapat mengubah listing miliknya.

Contoh header untuk endpoint donor (sesuaikan dengan middleware Auth):

```http
Authorization: Bearer <access_token>
```

## 3. GET `/food-listings/explore`

Menjelajahi listing yang tersedia untuk publik.

### Query parameters

| Parameter | Tipe | Default | Validasi |
|---|---|---|---|
| `categoryId` | UUID | — | Jika dikirim harus UUID valid |
| `regionId` | UUID | — | Jika dikirim harus UUID valid |
| `isHalal` | `"true"` / `"false"` | — | Hanya dua string tersebut |
| `isVegetarian` | `"true"` / `"false"` | — | Hanya dua string tersebut |
| `search` | string | — | Trim; maksimal 150 karakter |
| `page` | number | `1` | Coerce dari query string; integer minimal 1 |
| `limit` | number | `20` | Coerce dari query string; integer 1–50 |
| `sortBy` | `"newest"` / `"deadline"` | `"newest"` | Enum |

Query object strict. Parameter tambahan yang tidak ada dalam schema ditolak.

### Filter yang diterapkan repository

Semua hasil explore selalu memenuhi:
- `status = ACTIVE`
- `availablePortions >= 1`
- `pickupDeadline >= waktu saat query dijalankan`

Filter opsional:
- `categoryId`: cocok persis dengan kategori.
- `isHalal`: string query dikonversi ke boolean.
- `isVegetarian`: string query dikonversi ke boolean.
- `search`: pencarian `ILIKE` pada nama listing.
- `regionId`: cocok dengan `locations.regionId`.

### Sorting aktual

- `sortBy=newest` (default): `createdAt` descending.
- `sortBy=deadline`: `pickupDeadline` ascending.

Catatan source: repository membuat variabel `orderBy`, tetapi variabel tersebut tidak digunakan. Query `.orderBy()` yang benar-benar dijalankan tetap memilih `pickupDeadline` ascending atau `createdAt` descending.

### Pagination

Offset dihitung dengan:

```text
offset = (page - 1) * limit
```

Repository mengembalikan object:

```json
{
  "items": [
    {
      "id": "listing-uuid",
      "name": "Nasi Kotak",
      "description": "Makanan siap dibagikan",
      "availablePortions": 10,
      "isHalal": true,
      "isVegetarian": false,
      "allergens": ["PEANUT"],
      "producedAt": "2026-11-23T08:00:00.000Z",
      "pickupDeadline": "2026-11-24T10:00:00.000Z",
      "createdAt": "2026-11-23T08:30:00.000Z",
      "category": "Ready Meal",
      "categorySlug": "ready-meal",
      "regionId": "region-uuid",
      "locationLabel": "Dapur Utama"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

Ini adalah bentuk return repository/service yang terlihat. Wrapper HTTP final belum dapat dipastikan karena controller tidak disertakan.

### Contoh request

```http
GET /food-listings/explore?page=1&limit=20&sortBy=newest
```

```http
GET /food-listings/explore?categoryId=<category-uuid>&isHalal=true&regionId=<region-uuid>
```

```http
GET /food-listings/explore?search=nasi&isVegetarian=false&sortBy=deadline
```

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid explore query parameters` | Query tidak lolos `exploreFoodListingsQuerySchema` |

## 4. GET `/food-listings/categories`

Mengambil kategori makanan yang aktif.

Repository:
- Memfilter `foodCategories.isActive = true`.
- Memilih `id`, `name`, `slug`, dan `description`.
- Mengurutkan berdasarkan `name` ascending.

### Contoh request

```http
GET /food-listings/categories
```

### Bentuk data service

```json
[
  {
    "id": "category-uuid",
    "name": "Ready Meal",
    "slug": "ready-meal",
    "description": "Makanan siap santap"
  }
]
```

Controller response envelope dan status HTTP sukses tidak dapat dipastikan tanpa `food-listings.controller.ts`.

## 5. GET `/food-listings/:id`

Mengambil detail listing berdasarkan UUID. Endpoint ini public.

### Path parameter

| Parameter | Tipe | Validasi |
|---|---|---|
| `id` | UUID | Wajib UUID valid |

### Contoh request

```http
GET /food-listings/<listing-uuid>
```

### Bentuk data service/repository

Repository memilih field listing berikut:
- `id`, `donorId`, `categoryId`, `locationId`
- `name`, `description`
- `totalPortions`, `availablePortions`
- `isHalal`, `isVegetarian`, `allergens`
- `producedAt`, `storageInstructions`, `pickupDeadline`, `notes`
- `status`, `createdAt`, `updatedAt`, `closedAt`
- `categoryName`, `categorySlug`
- `images`

Images diambil dari `foodImages` berdasarkan `listingId`, diurutkan dengan `isPrimary` descending lalu `sortOrder` ascending. Kolom image mengikuti schema tabel karena repository menggunakan `select()` tanpa proyeksi field.

Bentuk konseptual return service:

```json
{
  "id": "listing-uuid",
  "donorId": "donor-uuid",
  "categoryId": "category-uuid",
  "locationId": "location-uuid",
  "name": "Nasi Kotak",
  "description": "Makanan siap dibagikan",
  "totalPortions": 20,
  "availablePortions": 12,
  "isHalal": true,
  "isVegetarian": false,
  "allergens": [],
  "producedAt": "2026-11-23T08:00:00.000Z",
  "storageInstructions": "Simpan di tempat sejuk",
  "pickupDeadline": "2026-11-24T10:00:00.000Z",
  "notes": null,
  "status": "ACTIVE",
  "createdAt": "2026-11-23T08:30:00.000Z",
  "updatedAt": "2026-11-23T08:30:00.000Z",
  "closedAt": null,
  "categoryName": "Ready Meal",
  "categorySlug": "ready-meal",
  "images": []
}
```

Field dan nilai di atas adalah ilustrasi; struktur kolom image dan tipe aktual harus dicocokkan dengan schema database.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid food listing ID` | Path parameter bukan UUID valid |
| 404 | `Food listing not found` | Listing tidak ditemukan |

## 6. GET `/food-listings/me` — Donor

Mengambil seluruh listing milik donor yang sedang login.

### Request

```http
GET /food-listings/me
Authorization: Bearer <access_token>
```

Tidak membutuhkan body atau query parameter.

### Bentuk data service/repository

Repository memilih:
- `id`
- `name`
- `totalPortions`
- `availablePortions`
- `status`
- `pickupDeadline`
- `createdAt`
- `categoryName`

Hasil diurutkan berdasarkan `createdAt` descending.

Contoh return service:

```json
[
  {
    "id": "listing-uuid",
    "name": "Nasi Kotak",
    "totalPortions": 20,
    "availablePortions": 12,
    "status": "ACTIVE",
    "pickupDeadline": "2026-11-24T10:00:00.000Z",
    "createdAt": "2026-11-23T08:30:00.000Z",
    "categoryName": "Ready Meal"
  }
]
```

Controller response envelope/status sukses belum dapat dipastikan tanpa source controller.

## 7. POST `/food-listings` — Membuat listing

Hanya donor individu dan donor bisnis yang dapat membuat listing.

### Request body

```json
{
  "name": "Nasi Kotak Ayam",
  "description": "Nasi kotak siap dibagikan",
  "categoryId": "<category-uuid>",
  "locationId": "<user-location-uuid>",
  "totalPortions": 20,
  "isHalal": true,
  "isVegetarian": false,
  "allergens": ["PEANUT"],
  "producedAt": "2026-11-23T08:00:00.000+07:00",
  "storageInstructions": "Simpan di tempat sejuk",
  "pickupDeadline": "2026-11-24T10:00:00.000+07:00",
  "notes": "Hubungi donor saat tiba"
}
```

### Validasi

| Field | Tipe | Wajib | Aturan |
|---|---|---:|---|
| `name` | string | Ya | Trim; 3–150 karakter |
| `description` | string atau `null` | Tidak | Trim; maksimal 5000 karakter |
| `categoryId` | UUID | Ya | UUID valid |
| `locationId` | UUID | Ya | UUID valid; merupakan ID relasi user-location |
| `totalPortions` | number | Ya | Integer positif |
| `isHalal` | boolean | Tidak | Default `false` |
| `isVegetarian` | boolean | Tidak | Default `false` |
| `allergens` | string[] | Tidak | Default `[]`; maksimal 50 item; setiap item di-trim dan 1–100 karakter |
| `producedAt` | ISO datetime | Ya | Harus menyertakan timezone/offset |
| `storageInstructions` | string | Ya | Trim; 1–2000 karakter |
| `pickupDeadline` | ISO datetime | Ya | Harus menyertakan timezone/offset |
| `notes` | string atau `null` | Tidak | Trim; maksimal 2000 karakter |

Object strict; field tambahan ditolak.

Refinement schema mensyaratkan `pickupDeadline` lebih akhir daripada `producedAt`. Error validasi refinement memiliki path `pickupDeadline` dan message:

```text
Pickup deadline must be after production time
```

### Aturan bisnis pembuatan

Repository melakukan pembuatan dalam transaksi:
1. Memeriksa donor profile.
2. Memeriksa verifikasi email.
3. Untuk donor bisnis, memeriksa verifikasi bisnis.
4. Memastikan kategori ditemukan dan aktif.
5. Memastikan `locationId` adalah ID relasi pada `userLocations` yang dimiliki donor. API menerima `userLocations.id`, kemudian menyimpan `userLocations.locationId` ke listing.
6. Untuk donor individu:
   - Maksimal 20 porsi per listing.
   - Maksimal 3 listing aktif (menggunakan `ACTIVE_LISTING_STATUSES`).
7. Listing dibuat dengan `availablePortions` sama dengan `totalPortions` dan `status = ACTIVE`.

Business rule verifikasi:
- Donor individu dapat membuat listing jika email sudah diverifikasi; verifikasi nomor telepon tidak diperiksa oleh logic create yang terlihat.
- Donor bisnis memerlukan business verification.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 403 | `Only donors can create food listings` | Role bukan donor pada service |
| 404 | `Donor profile not found` | Profil donor tidak ditemukan |
| 403 | `Verify your email before creating a listing` | Email belum diverifikasi |
| 403 | `Business donor verification is required` | Verifikasi bisnis belum terpenuhi |
| 400 | `Food category is invalid or inactive` | Kategori tidak ditemukan/tidak aktif |
| 400 | `Location does not belong to this donor` | Lokasi bukan milik donor |
| 409 | `Individual donors can only have 3 active listings` | Donor individu sudah mencapai batas listing aktif |
| 400 | `Individual donors can list a maximum of 20 portions` | Donor individu mengirim lebih dari 20 porsi |

Repository juga dapat melempar error internal `FOOD_LISTING_CREATION_FAILED` jika insert tidak mengembalikan row. Status HTTP finalnya bergantung pada error handler global.

### Success response

Controller tidak disertakan, sehingga status sukses dan envelope JSON endpoint POST tidak dapat diverifikasi. Service mengembalikan row listing hasil insert.

## 8. PATCH `/food-listings/:id` — Update listing

Donor hanya dapat memperbarui listing miliknya yang masih berstatus `ACTIVE`.

### Path parameter

`id` harus UUID valid.

### Request body

Semua field bersifat optional, tetapi minimal satu field harus dikirim.

```json
{
  "name": "Nasi Kotak Ayam Terbaru",
  "description": "Deskripsi terbaru",
  "categoryId": "<category-uuid>",
  "locationId": "<user-location-uuid>",
  "totalPortions": 25,
  "isHalal": true,
  "isVegetarian": false,
  "allergens": ["PEANUT", "MILK"],
  "producedAt": "2026-11-23T08:00:00.000+07:00",
  "storageInstructions": "Simpan dalam pendingin",
  "pickupDeadline": "2026-11-24T12:00:00.000+07:00",
  "notes": null
}
```

### Validasi

| Field | Tipe | Aturan |
|---|---|---|
| `name` | string | Optional; trim; 3–150 karakter |
| `description` | string atau `null` | Optional; trim; maksimal 5000 karakter |
| `categoryId` | UUID | Optional |
| `locationId` | UUID | Optional; ID relasi user-location |
| `totalPortions` | number | Optional; integer positif |
| `isHalal` | boolean | Optional |
| `isVegetarian` | boolean | Optional |
| `allergens` | string[] | Optional; maksimal 50 item; setiap item 1–100 karakter setelah trim |
| `producedAt` | ISO datetime | Optional; wajib timezone/offset |
| `storageInstructions` | string | Optional; trim; 1–2000 karakter |
| `pickupDeadline` | ISO datetime | Optional; wajib timezone/offset |
| `notes` | string atau `null` | Optional; trim; maksimal 2000 karakter |

Object strict dan minimal satu key wajib disediakan.

### Aturan bisnis update

1. Listing dicari berdasarkan `id` dan `donorId` dalam transaksi dengan row lock (`FOR UPDATE`).
2. Listing harus ada dan statusnya `ACTIVE`.
3. Kombinasi tanggal produksi dan pickup deadline setelah update harus memenuhi `pickupDeadline > producedAt`.
4. Jika kategori diubah, kategori baru harus ada dan aktif.
5. Jika lokasi diubah, `locationId` harus merupakan `userLocations.id` milik donor. ID lokasi sebenarnya (`locations.id`) yang disimpan.
6. Jika `totalPortions` diubah, sistem menjumlahkan porsi request berstatus `APPROVED` dan `IN_PROGRESS` sebagai reserved portions. Nilai total baru tidak boleh lebih kecil dari jumlah tersebut.
7. Saat total porsi berubah, available portions dihitung ulang dengan mempertahankan jumlah porsi yang sudah terpakai/terreservasi menurut rumus:
   `max(0, totalPortionsBaru - (totalPortionsLama - availablePortionsLama))`.
8. Field yang tidak dikirim tidak diubah. `updatedAt` diperbarui.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid food listing ID` | ID path bukan UUID valid |
| 404 | `Food listing not found` | Listing tidak ditemukan atau bukan milik donor |
| 400 | `Food category is invalid or inactive` | Kategori baru tidak ditemukan/tidak aktif |
| 400 | `Location does not belong to this donor` | Lokasi baru bukan milik donor |
| 409 | `Only active listings can be modified or closed` | Listing bukan `ACTIVE` |
| 409 | `Total portions cannot be lower than already reserved portions` | Total baru lebih kecil dari reserved portions |
| 400 | `Pickup deadline must be later than produced date` | Deadline tidak lebih akhir dari tanggal produksi |

Repository dapat melempar error internal `FOOD_LISTING_UPDATE_FAILED` jika update tidak mengembalikan row.

### Success response

Controller tidak disertakan; status sukses dan envelope JSON belum dapat diverifikasi. Service mengembalikan row listing hasil update.

## 9. DELETE `/food-listings/:id` — Close listing

Endpoint DELETE tidak menghapus row secara fisik. Implementasi mengubah status listing menjadi `CLOSED`.

### Request

```http
DELETE /food-listings/<listing-uuid>
Authorization: Bearer <access_token>
```

Tidak membutuhkan request body.

### Aturan bisnis close

1. Listing dicari berdasarkan `listingId` dan `donorId` dengan row lock.
2. Listing harus ada dan berstatus `ACTIVE`.
3. Sistem memeriksa request untuk listing tersebut.
4. Jika ada request berstatus `PENDING`, `APPROVED`, atau `IN_PROGRESS`, listing tidak dapat ditutup.
5. Jika tidak ada unresolved request, listing diubah menjadi:
   - `status = CLOSED`
   - `availablePortions = 0`
   - `closedAt = waktu saat ini`
   - `updatedAt = waktu saat ini`

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid food listing ID` | ID path bukan UUID valid |
| 404 | `Food listing not found` | Listing tidak ditemukan atau bukan milik donor |
| 409 | `Only active listings can be modified or closed` | Listing bukan `ACTIVE` |
| 500 | `Food listing operation failed` | Fallback error mapping service |

Repository dapat melempar error internal `FOOD_LISTING_CLOSE_FAILED` jika update close tidak mengembalikan row.

**Catatan mismatch source:** repository mengembalikan reason `LISTING_NOT_ACTIVE` ketika menemukan request unresolved. Service memetakan reason tersebut menjadi `Only active listings can be modified or closed`. Service memiliki mapping `UNRESOLVED_REQUESTS` dengan message berbeda, tetapi repository yang dikirim tidak mengembalikan reason tersebut. Jadi message `Resolve pending or active requests before closing this listing` tidak akan muncul dari jalur repository yang terlihat.

### Success response

Controller tidak disertakan; status sukses dan envelope JSON belum dapat diverifikasi. Service mengembalikan row listing setelah ditutup.

## 10. Contoh request Bruno

Environment:

```text
baseUrl = http://localhost:3000
accessToken = <access-token-donor>
```

### Public — explore

```http
GET {{baseUrl}}/food-listings/explore?page=1&limit=20&sortBy=newest
```

### Public — categories

```http
GET {{baseUrl}}/food-listings/categories
```

### Public — detail

```http
GET {{baseUrl}}/food-listings/<listing-uuid>
```

### Donor — my listings

```http
GET {{baseUrl}}/food-listings/me
Authorization: Bearer {{accessToken}}
```

### Donor — create listing

```http
POST {{baseUrl}}/food-listings
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "name": "Nasi Kotak Ayam",
  "description": "Nasi kotak siap dibagikan",
  "categoryId": "<category-uuid>",
  "locationId": "<user-location-uuid>",
  "totalPortions": 20,
  "isHalal": true,
  "isVegetarian": false,
  "allergens": [],
  "producedAt": "2026-11-23T08:00:00.000+07:00",
  "storageInstructions": "Simpan di tempat sejuk",
  "pickupDeadline": "2026-11-24T10:00:00.000+07:00",
  "notes": null
}
```

### Donor — update listing

```http
PATCH {{baseUrl}}/food-listings/<listing-uuid>
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "totalPortions": 25,
  "pickupDeadline": "2026-11-24T12:00:00.000+07:00"
}
```

### Donor — close listing

```http
DELETE {{baseUrl}}/food-listings/<listing-uuid>
Authorization: Bearer {{accessToken}}
```

## 11. Hal yang perlu diperhatikan / diverifikasi

1. **Controller belum disertakan.** Perlu `food-listings.controller.ts` untuk melengkapi status HTTP sukses, response envelope, dan pemetaan `req.auth` ke service.
2. **Schema database belum disertakan.** Perlu schema `foodListings`, `foodImages`, `foodCategories`, dan relasi lokasi untuk memastikan tipe kolom serta field lengkap response.
3. **Create individual limits:** maksimal 3 listing aktif dan 20 porsi per listing.
4. **Business verification:** donor bisnis harus lolos verifikasi bisnis; donor individu cukup email verified pada logic yang terlihat.
5. **Phone verification:** tidak terlihat menjadi prasyarat create listing.
6. **Location ID:** request menggunakan ID relasi `userLocations`, bukan `locations.id`.
7. **Explore deadline sort:** ascending; listing dengan deadline paling dekat muncul lebih dahulu.
8. **Explore filters:** listing hanya ditampilkan jika ACTIVE, masih punya porsi, dan deadline belum lewat.
9. **Close semantics:** DELETE menutup listing, bukan hard delete.
10. **Unresolved request mapping:** repository mengembalikan `LISTING_NOT_ACTIVE`, sehingga service memakai pesan generic status listing tidak aktif; mapping `UNRESOLVED_REQUESTS` tampak tidak terpakai oleh repository saat ini.
11. **Create error:** `FOOD_LISTING_CREATION_FAILED`, update error `FOOD_LISTING_UPDATE_FAILED`, dan close error `FOOD_LISTING_CLOSE_FAILED` adalah Error biasa, bukan `AppError`; respons HTTP akhirnya bergantung pada global error handler.
12. Prefix mount dan format error middleware perlu dicocokkan dengan entry point aplikasi.

## 12. Source tambahan untuk finalisasi dokumentasi

Agar bagian response dan status sukses dapat ditulis persis, kirim:

```text
src/modules/food-listings/food-listings.controller.ts
src/database/schema/food-listings.ts
src/database/schema/food-images.ts
src/database/schema/food-categories.ts
```

Jika nama file schema berbeda, kirim hasil:

```bash
find src/database/schema -maxdepth 1 -type f | sort
```
