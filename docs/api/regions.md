# SESAJI API — Regions Module

> Dokumentasi ini disusun dari source `src/modules/regions/` yang diberikan. Contoh UUID dan data response bersifat ilustratif. Prefix mount router dan format error global perlu diverifikasi dari entry point serta middleware aplikasi.

## 1. Ringkasan

Regions module menyediakan data hierarki wilayah dan endpoint administrasi untuk mengelolanya.

| Method | Endpoint | Akses | Success status |
|---|---|---|---:|
| GET | `/regions` | Public | 200 |
| GET | `/regions/:id/children` | Public | 200 |
| GET | `/regions/:id` | Public | 200 |
| POST | `/regions` | Admin | 201 |
| PATCH | `/regions/:id` | Admin | 200 |
| DELETE | `/regions/:id` | Admin | 200 |

Path mengasumsikan router dipasang dengan prefix `/regions`.

## 2. Autentikasi dan otorisasi

- Endpoint GET bersifat public: route tidak memasang `authenticate` atau `authorize`.
- Endpoint POST, PATCH, dan DELETE memasang `authenticate` lalu `authorize("ADMIN")`.
- Operasi administrasi membutuhkan user terautentikasi dengan role `ADMIN`.
- Detail format access token, error autentikasi, dan error otorisasi mengikuti middleware masing-masing dan tidak didefinisikan dalam module Regions.

Contoh header untuk endpoint admin (sesuaikan mekanisme Auth aplikasi):

```http
Authorization: Bearer <access_token>
```

## 3. Bentuk data region

Repository menggunakan `select()` terhadap tabel `regions`, sehingga response region memuat kolom tabel yang didefinisikan pada schema database.

Dari source module dapat dipastikan field yang digunakan untuk logika:
- `id`
- `name`
- `regionType`
- `parentId`

Field tambahan, tipe kolom, dan timestamp (jika ada) perlu dicocokkan dengan `database/schema/regions.ts`. Contoh response di bawah hanya menampilkan empat field yang dapat dipastikan dari source ini.

## 4. GET `/regions`

Mengambil daftar region. Query parameter dapat digunakan untuk memfilter berdasarkan parent dan/atau tipe region.

### Query parameters

| Parameter | Tipe | Aturan | Perilaku |
|---|---|---|---|
| `parentId` | UUID atau string literal `null` | Optional | UUID memfilter anak dari parent tersebut; literal `null` memfilter root region |
| `regionType` | string | Optional; trim; 1–100 karakter | Memfilter berdasarkan tipe region |

Perbedaan penting:
- `GET /regions` tanpa `parentId`: tidak membatasi parent, sehingga dapat mengembalikan seluruh level hierarki.
- `GET /regions?parentId=null`: hanya region dengan `parentId IS NULL` (root).
- `GET /regions?parentId=<uuid>`: hanya anak langsung dari parent tersebut.
- `regionType` dapat digunakan bersama `parentId`.
- Hasil diurutkan berdasarkan `name` ascending.

### Contoh request

```http
GET /regions
```

```http
GET /regions?parentId=null
```

```http
GET /regions?parentId=550e8400-e29b-41d4-a716-446655440000&regionType=CITY
```

### Response sukses — 200

```json
{
  "success": true,
  "message": "Regions retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Contoh Provinsi",
      "regionType": "PROVINCE",
      "parentId": null
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Contoh Kota",
      "regionType": "CITY",
      "parentId": "550e8400-e29b-41d4-a716-446655440000"
    }
  ]
}
```

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid region query parameters` | Query tidak sesuai `regionQuerySchema` |

Schema query bersifat strict; parameter query tambahan yang tidak didefinisikan dapat menyebabkan validasi gagal.

## 5. GET `/regions/:id`

Mengambil satu region berdasarkan UUID.

### Path parameter

| Parameter | Tipe | Aturan |
|---|---|---|
| `id` | UUID | Wajib |

Route menjalankan `validateRegionId` sebelum controller.

### Contoh request

```http
GET /regions/550e8400-e29b-41d4-a716-446655440000
```

### Response sukses — 200

```json
{
  "success": true,
  "message": "Region retrieved successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Contoh Provinsi",
    "regionType": "PROVINCE",
    "parentId": null
  }
}
```

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid region ID` | Path parameter bukan UUID valid |
| 404 | `Region not found` | UUID valid tetapi region tidak ditemukan |

## 6. GET `/regions/:id/children`

Mengambil anak langsung dari region tertentu. Endpoint ini tidak mengambil seluruh descendant bertingkat.

### Path parameter

| Parameter | Tipe | Aturan |
|---|---|---|
| `id` | UUID | Wajib |

### Contoh request

```http
GET /regions/550e8400-e29b-41d4-a716-446655440000/children
```

### Response sukses — 200

```json
{
  "success": true,
  "message": "Child regions retrieved successfully",
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Contoh Kota",
      "regionType": "CITY",
      "parentId": "550e8400-e29b-41d4-a716-446655440000"
    }
  ]
}
```

Jika region memiliki anak langsung kosong, `data` berupa array kosong. Hasil diurutkan berdasarkan nama ascending.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid region ID` | Path parameter bukan UUID valid |
| 404 | `Parent region not found` | Region induk tidak ditemukan |

## 7. POST `/regions` — Admin

Membuat region baru. `parentId` dapat diisi UUID parent atau `null` untuk membuat root region.

### Request body

```json
{
  "name": "Contoh Kota",
  "regionType": "CITY",
  "parentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Contoh membuat root region:

```json
{
  "name": "Contoh Provinsi",
  "regionType": "PROVINCE",
  "parentId": null
}
```

### Validasi

| Field | Tipe | Wajib | Aturan |
|---|---|---:|---|
| `name` | string | Ya | Trim; 1–255 karakter |
| `regionType` | string | Ya | Trim; 1–100 karakter |
| `parentId` | UUID atau `null` | Tidak | Jika diisi UUID harus valid; default service menjadi `null` jika tidak dikirim |

Object bersifat strict; field tambahan ditolak.

### Aturan bisnis

- Jika `parentId` berisi UUID, parent harus ada.
- Nama region tidak boleh duplikat di bawah parent yang sama.
- Pengecekan duplikasi membandingkan `name` dan `parentId`.
- Root region juga dicek duplikatnya terhadap root lain dengan nama yang sama.
- Source tidak membatasi nilai `regionType` ke enum tertentu; schema menerima string 1–100 karakter.

### Response sukses — 201

```json
{
  "success": true,
  "message": "Region created successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Contoh Kota",
    "regionType": "CITY",
    "parentId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

Response aktual adalah row hasil `INSERT ... RETURNING` dan dapat memuat field lain sesuai schema database.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 404 | `Parent region not found` | `parentId` diberikan tetapi tidak ditemukan |
| 409 | `A region with this name already exists under the same parent` | Nama sudah digunakan pada parent yang sama |

## 8. PATCH `/regions/:id` — Admin

Memperbarui nama, tipe, dan/atau parent region.

### Request body

Contoh mengganti nama:

```json
{
  "name": "Nama Region Baru"
}
```

Contoh memindahkan parent:

```json
{
  "parentId": "770e8400-e29b-41d4-a716-446655440000"
}
```

Contoh menjadikan region sebagai root:

```json
{
  "parentId": null
}
```

Contoh memperbarui beberapa field:

```json
{
  "name": "Kabupaten Contoh",
  "regionType": "REGENCY",
  "parentId": "770e8400-e29b-41d4-a716-446655440000"
}
```

### Validasi

| Field | Tipe | Wajib | Aturan |
|---|---|---:|---|
| `name` | string | Tidak | Trim; 1–255 karakter |
| `regionType` | string | Tidak | Trim; 1–100 karakter |
| `parentId` | UUID atau `null` | Tidak | UUID harus valid; `null` berarti root |

Ketentuan:
- Object strict.
- Minimal satu field harus dikirim.
- `parentId: null` diperbolehkan.
- Field yang tidak dikirim tidak diubah.

### Aturan hierarki dan duplikasi

Service menjalankan pemeriksaan berikut:
1. Region target harus ada.
2. Jika parent baru berupa UUID, parent tersebut harus ada.
3. Region tidak boleh menjadi parent bagi dirinya sendiri.
4. Region tidak boleh dipindahkan ke salah satu descendant-nya sendiri, untuk mencegah circular hierarchy.
5. Nama tidak boleh duplikat di bawah parent yang sama. Jika `name` tidak dikirim, nama saat ini dipakai dalam pemeriksaan; jika `parentId` tidak dikirim, parent saat ini dipakai.
6. Setelah lolos validasi, data diperbarui.

### Response sukses — 200

```json
{
  "success": true,
  "message": "Region updated successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Kabupaten Contoh",
    "regionType": "REGENCY",
    "parentId": "770e8400-e29b-41d4-a716-446655440000"
  }
}
```

Response aktual adalah row hasil update dan dapat memuat field lain dari schema database.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid region ID` | ID path bukan UUID valid |
| 400 | `A region cannot be its own parent` | `parentId` sama dengan ID region yang diedit |
| 400 | `A region cannot be moved under its own descendant` | Parent baru adalah descendant dari region |
| 404 | `Region not found` | Region target tidak ditemukan |
| 404 | `Parent region not found` | Parent baru tidak ditemukan |
| 409 | `A region with this name already exists under the same parent` | Nama sudah digunakan pada parent yang sama |

## 9. DELETE `/regions/:id` — Admin

Menghapus region. Region hanya dapat dihapus jika tidak memiliki child langsung.

### Request

```http
DELETE /regions/660e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <admin_access_token>
```

Tidak memerlukan request body.

### Response sukses — 200

```json
{
  "success": true,
  "message": "Region deleted successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Contoh Kota",
    "regionType": "CITY",
    "parentId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

`data` merupakan row yang dikembalikan oleh operasi delete.

### Aturan bisnis

- Region harus ada.
- Region yang masih memiliki child langsung tidak dapat dihapus.
- Service mengembalikan `409` jika masih ada child.
- Source service hanya memeriksa child langsung. Dampak foreign key terhadap referensi lain (misalnya tabel lain yang memakai region) bergantung pada schema database dan constraint yang berlaku.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Invalid region ID` | ID path bukan UUID valid |
| 404 | `Region not found` | Region tidak ditemukan |
| 409 | `Cannot delete a region that still has child regions` | Masih memiliki child langsung |

## 10. Contoh request Bruno

Environment:

```text
baseUrl = http://localhost:3000
adminAccessToken = <admin-access-token>
```

### Public — get all regions

```http
GET {{baseUrl}}/regions
```

### Public — get root regions

```http
GET {{baseUrl}}/regions?parentId=null
```

### Public — filter by parent and type

```http
GET {{baseUrl}}/regions?parentId=550e8400-e29b-41d4-a716-446655440000&regionType=CITY
```

### Public — get region detail

```http
GET {{baseUrl}}/regions/550e8400-e29b-41d4-a716-446655440000
```

### Public — get direct children

```http
GET {{baseUrl}}/regions/550e8400-e29b-41d4-a716-446655440000/children
```

### Admin — create region

```http
POST {{baseUrl}}/regions
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json

{
  "name": "Contoh Kota",
  "regionType": "CITY",
  "parentId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Admin — update region

```http
PATCH {{baseUrl}}/regions/660e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {{adminAccessToken}}
Content-Type: application/json

{
  "name": "Kota Contoh Baru"
}
```

### Admin — delete region

```http
DELETE {{baseUrl}}/regions/660e8400-e29b-41d4-a716-446655440000
Authorization: Bearer {{adminAccessToken}}
```

## 11. Catatan implementasi dan hal yang perlu diverifikasi

1. GET routes public, sedangkan POST/PATCH/DELETE hanya admin.
2. Query `parentId=null` adalah string literal `"null"` yang dikonversi controller menjadi JavaScript `null`, lalu query `IS NULL`.
3. Tanpa query `parentId`, endpoint list mengembalikan semua level hierarki, bukan hanya root.
4. Endpoint `/children` mengambil anak langsung saja, bukan seluruh keturunan.
5. `regionType` adalah string bebas pada schema request, bukan enum Zod.
6. Query `findChildrenByParentIds` tidak memiliki `orderBy`, tetapi endpoint children menggunakan `findChildRegions` yang mengurutkan nama ascending.
7. Source belum menunjukkan pagination atau limit untuk list region.
8. Periksa `database/schema/regions.ts` untuk memastikan seluruh field row dan tipe response aktual.
9. Prefix router, error body global, serta format kegagalan autentikasi/otorisasi perlu dicocokkan dengan entry point dan middleware aplikasi.
