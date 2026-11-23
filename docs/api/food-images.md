# SESAJI API — Food Images Module

> Dokumentasi berdasarkan source `food-images` yang diberikan: controller, repository, routes, service, types, dan validation. Prefix mount router dan konfigurasi global aplikasi tidak disertakan.

## 1. Ringkasan

Food Images menangani proses upload gambar listing makanan ke object storage Cloudflare R2 dan pencatatan metadata gambar ke database.

Alur upload dipisah menjadi dua tahap:
1. Client meminta signed upload URL melalui API.
2. Client mengunggah file langsung ke storage menggunakan HTTP `PUT`.
3. Client mendaftarkan `objectKey` yang telah diunggah ke API agar metadata gambar disimpan di database.

Modul juga menyediakan pengambilan gambar berdasarkan listing, pengaturan gambar utama (primary), dan penghapusan gambar.

Batas maksimum:
- Ukuran file: 5 MB.
- Jumlah gambar: maksimal 5 gambar per listing.
- Format: JPEG, PNG, WebP.

## 2. Authentication dan authorization

| Akses | Role |
|---|---|
| `GET /listing/:listingId` | Public, tanpa `authenticate` |
| `POST /upload-url` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` |
| `POST /` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` |
| `PATCH /:id/primary` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` |
| `DELETE /:id` | `DONOR_INDIVIDUAL`, `DONOR_BUSINESS` |

Semua endpoint donor melewati middleware `authenticate` dan `authorize("DONOR_INDIVIDUAL", "DONOR_BUSINESS")`.

Untuk operasi upload URL dan registrasi, listing harus dimiliki oleh donor yang sedang login. Operasi set primary dan delete juga memeriksa kepemilikan listing melalui relasi image ke listing.

## 3. Endpoint

Path di bawah relatif terhadap router `food-images`. Prefix mount di API entry point tidak disertakan.

| Method | Path | Auth | Fungsi |
|---|---|---|---|
| `GET` | `/listing/:listingId` | Public | Mengambil gambar pada sebuah listing |
| `POST` | `/upload-url` | Donor | Membuat signed upload URL |
| `POST` | `/` | Donor | Mendaftarkan metadata gambar setelah upload |
| `PATCH` | `/:id/primary` | Donor | Menjadikan gambar sebagai primary |
| `DELETE` | `/:id` | Donor | Menghapus gambar dari storage dan database |

## 4. Detail endpoint

### 4.1 Generate upload URL

`POST /upload-url`

Role: `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`

Request body:

```json
{
  "listingId": "UUID",
  "originalFilename": "makanan.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 2048000
}
```

Validasi:
- `listingId`: UUID, wajib.
- `originalFilename`: string di-trim, 1–255 karakter.
- `contentType`: salah satu `image/jpeg`, `image/png`, `image/webp`.
- `sizeBytes`: integer positif, maksimum 5 MB (`5 * 1024 * 1024`).
- Object strict; field tambahan ditolak.

Business rules:
1. Listing harus ditemukan dan dimiliki oleh donor yang login.
2. Ukuran tidak boleh melebihi 5 MB.
3. Format MIME harus didukung.
4. Object key dibuat dengan pola `food-listings/{listingId}/{randomUUID}.{extension}`.
5. Extension dipetakan dari MIME:
   - `image/jpeg` → `jpg`
   - `image/png` → `png`
   - `image/webp` → `webp`
6. Service meminta signed upload URL ke storage melalui `createUploadUrl`.

Response sukses dari controller:

```json
{
  "success": true,
  "message": "Upload URL generated successfully",
  "data": {
    "uploadUrl": "SIGNED_UPLOAD_URL",
    "objectKey": "food-listings/LISTING_UUID/GENERATED_UUID.jpg",
    "method": "PUT",
    "headers": {
      "Content-Type": "image/jpeg"
    },
    "expiresIn": 900
  }
}
```

`expiresIn` di atas hanya contoh format angka; nilai aktual berasal dari integrasi storage (`createUploadUrl`) dan tidak ditetapkan oleh module ini.

HTTP status sukses: `200`.

Error yang dipetakan service:
| HTTP | Message |
|---:|---|
| 404 | `Food listing not found` |
| 400 | `Image size cannot exceed 5 MB` |
| 400 | `Unsupported image format` |

Error dari integrasi storage dapat diteruskan ke error handler global; implementasi lengkapnya tidak ada pada source module ini.

### 4.2 Register food image

`POST /`

Role: `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`

Endpoint ini dipanggil setelah client berhasil mengunggah file ke signed URL.

Request body:

```json
{
  "listingId": "UUID",
  "objectKey": "food-listings/LISTING_UUID/GENERATED_UUID.jpg",
  "originalFilename": "makanan.jpg",
  "altText": "Paket makanan siap dibagikan",
  "isPrimary": false
}
```

Validasi:
- `listingId`: UUID.
- `objectKey`: string di-trim, 1–500 karakter.
- `originalFilename`: string di-trim, 1–255 karakter.
- `altText`: string di-trim, maksimal 255 karakter; boleh `null` atau tidak dikirim.
- `isPrimary`: boolean, default `false`.
- Object strict.

Business rules:
1. Listing harus ditemukan dan dimiliki donor.
2. `objectKey` harus diawali `food-listings/{listingId}/`.
3. `objectKey` ditolak jika mengandung `..` atau diawali `/`.
4. Metadata object diambil dari storage menggunakan `getObjectMetadata`.
5. Jika object tidak ditemukan di storage, service mengembalikan `400 Uploaded image was not found in storage`.
6. MIME dari object harus salah satu format yang didukung.
7. `ContentLength` harus tersedia, lebih dari 0, dan tidak lebih dari 5 MB.
8. Gambar disimpan ke database menggunakan public URL dari `getPublicObjectUrl(objectKey)`.
9. Maksimal 5 gambar per listing.
10. Gambar pertama otomatis menjadi primary. Gambar berikutnya menjadi primary jika `isPrimary: true`.
11. Jika gambar baru ditetapkan sebagai primary, primary lama pada listing tersebut diubah menjadi `false`.
12. Pembuatan metadata dilakukan dalam transaksi dengan row listing dikunci (`FOR UPDATE`) untuk menyerialisasi penambahan gambar pada listing yang sama.
13. Jika pendaftaran database gagal karena listing tidak ditemukan atau batas gambar tercapai, service mencoba menghapus object yang sudah terunggah dari storage.

Response sukses dari controller:

```json
{
  "success": true,
  "message": "Food image registered successfully",
  "data": {
    "id": "IMAGE_UUID",
    "listingId": "LISTING_UUID",
    "fileUrl": "https://PUBLIC_STORAGE_URL/...",
    "originalFilename": "makanan.jpg",
    "altText": "Paket makanan siap dibagikan",
    "isPrimary": true,
    "sortOrder": 0
  }
}
```

Objek `data` di atas menggambarkan field utama dari record image; field aktual mengikuti schema database `foodImages` yang dikembalikan oleh Drizzle.

HTTP status sukses: `201`.

Error:
| HTTP | Message |
|---:|---|
| 404 | `Food listing not found` |
| 400 | `Invalid storage object key` |
| 400 | `Uploaded image was not found in storage` |
| 400 | `Unsupported uploaded image format` |
| 400 | `Uploaded image must be between 1 byte and 5 MB` |
| 409 | `A listing can contain a maximum of 5 images` |
| 502 | `Image registration failed and storage cleanup is pending` |

Jika cleanup object gagal setelah registrasi database gagal, error `502` digunakan. Error database insert `FOOD_IMAGE_CREATION_FAILED` tidak dipetakan secara khusus oleh service.

### 4.3 Get listing images

`GET /listing/:listingId`

Auth: Public.

Path parameter:
- `listingId`: UUID food listing.

Validasi route:
- `listingId` harus UUID.
- Jika tidak valid, route mengirim `400 Invalid food listing ID`.

Data dikembalikan dari tabel `foodImages`, difilter berdasarkan `listingId`, lalu diurutkan:
1. `isPrimary` descending (primary lebih dahulu).
2. `sortOrder` ascending.

Response sukses:

```json
{
  "success": true,
  "message": "Food images retrieved successfully",
  "data": [
    {
      "id": "IMAGE_UUID",
      "listingId": "LISTING_UUID",
      "fileUrl": "https://PUBLIC_STORAGE_URL/...",
      "originalFilename": "makanan.jpg",
      "altText": "Paket makanan",
      "isPrimary": true,
      "sortOrder": 0
    }
  ]
}
```

HTTP status sukses: `200`.

Repository menggunakan `select()` penuh dari tabel `foodImages`, sehingga field `data` mengikuti kolom tabel yang ada pada schema database.

### 4.4 Set primary image

`PATCH /:id/primary`

Role: `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`

Path parameter:
- `id`: UUID food image.

Request body: tidak diperlukan.

Business rules:
1. Image harus ditemukan.
2. Listing yang terkait harus ditemukan dan dimiliki donor yang login.
3. Dalam transaksi, semua gambar pada listing tersebut terlebih dahulu diubah menjadi `isPrimary: false`.
4. Gambar yang dipilih kemudian diubah menjadi `isPrimary: true`.
5. Row listing dikunci (`FOR UPDATE`) selama operasi.

Response sukses:

```json
{
  "success": true,
  "message": "Primary image updated successfully",
  "data": {
    "id": "IMAGE_UUID",
    "listingId": "LISTING_UUID",
    "isPrimary": true
  }
}
```

HTTP status sukses: `200`.

Error:
| HTTP | Message |
|---:|---|
| 400 | `Invalid food image ID` |
| 404 | `Food image not found` |
| 404 | `Food listing not found` |

Jika update tidak mengembalikan row, repository melempar `FOOD_IMAGE_UPDATE_FAILED`; pemetaan akhirnya bergantung pada error handler global.

### 4.5 Delete food image

`DELETE /:id`

Role: `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`

Path parameter:
- `id`: UUID food image.

Request body: tidak diperlukan.

Business rules:
1. Image harus ditemukan dan terkait dengan listing milik donor yang login.
2. `fileUrl` dikonversi menjadi object key melalui `getObjectKeyFromPublicUrl`.
3. Object fisik di storage dihapus lebih dahulu.
4. Setelah penghapusan storage berhasil, metadata image dihapus dari database.
5. Jika penghapusan storage gagal, metadata database tidak dihapus oleh alur ini.

Response sukses:

```json
{
  "success": true,
  "message": "Food image deleted successfully",
  "data": {
    "id": "IMAGE_UUID",
    "listingId": "LISTING_UUID",
    "fileUrl": "https://PUBLIC_STORAGE_URL/...",
    "originalFilename": "makanan.jpg",
    "altText": "Paket makanan",
    "isPrimary": false,
    "sortOrder": 1
  }
}
```

`data` adalah record image yang diambil sebelum penghapusan metadata.

HTTP status sukses: `200`.

Error:
| HTTP | Message |
|---:|---|
| 400 | `Invalid food image ID` |
| 404 | `Food image not found` |
| 500 | `Invalid image storage URL configuration` |
| 502 | `Failed to delete image from storage` |
| 500 | `Image was deleted from storage but metadata cleanup failed` |

## 5. Alur upload dari client

```text
Client
  |
  | 1. POST /upload-url
  v
SESAJI API
  |
  | 2. Return uploadUrl + objectKey
  v
Client
  |
  | 3. PUT file ke uploadUrl
  |    Header Content-Type sesuai MIME
  v
Cloudflare R2
  |
  | 4. Upload berhasil
  v
Client
  |
  | 5. POST / dengan listingId + objectKey + metadata
  v
SESAJI API
  |
  | 6. Verifikasi object metadata di R2
  | 7. Simpan metadata gambar ke database
  v
Database
```

### Contoh request PUT langsung ke storage

Gunakan URL dan header yang dikembalikan endpoint `/upload-url`.

```http
PUT SIGNED_UPLOAD_URL
Content-Type: image/jpeg

(binary file)
```

Jangan mengirim file binary ke endpoint `POST /` untuk registrasi metadata. Endpoint tersebut menerima JSON yang berisi `objectKey` dan metadata gambar.

## 6. Contoh pengujian Bruno

Gunakan base URL dan token dari environment Bruno. Prefix `/food-images` di bawah perlu disesuaikan dengan mount router aplikasi.

### Generate upload URL

```http
POST {{baseUrl}}/food-images/upload-url
Authorization: Bearer {{donorToken}}
Content-Type: application/json
```

```json
{
  "listingId": "{{listingId}}",
  "originalFilename": "makanan.jpg",
  "contentType": "image/jpeg",
  "sizeBytes": 2048000
}
```

### Upload binary

Lakukan request `PUT` terpisah ke `uploadUrl` yang dikembalikan API:
- URL: signed `uploadUrl`
- Header: `Content-Type: image/jpeg`
- Body: file binary

### Register image

```http
POST {{baseUrl}}/food-images
Authorization: Bearer {{donorToken}}
Content-Type: application/json
```

```json
{
  "listingId": "{{listingId}}",
  "objectKey": "{{objectKey}}",
  "originalFilename": "makanan.jpg",
  "altText": "Paket makanan",
  "isPrimary": false
}
```

### Get listing images

```http
GET {{baseUrl}}/food-images/listing/{{listingId}}
```

Tidak memerlukan token.

### Set primary image

```http
PATCH {{baseUrl}}/food-images/{{imageId}}/primary
Authorization: Bearer {{donorToken}}
```

### Delete image

```http
DELETE {{baseUrl}}/food-images/{{imageId}}
Authorization: Bearer {{donorToken}}
```

## 7. Catatan implementasi

1. **Upload dilakukan langsung ke R2.** API hanya membuat signed URL dan kemudian memverifikasi object sebelum menyimpan metadata.
2. **Batas ukuran divalidasi dua kali.** Schema upload URL membatasi `sizeBytes` sampai 5 MB; saat registrasi service memeriksa ukuran aktual dari metadata storage, termasuk ukuran minimal 1 byte.
3. **Batas lima gambar ditegakkan di repository.** Penambahan image mengunci row listing dalam transaksi sebelum menghitung jumlah image.
4. **Gambar pertama otomatis primary.** Ini berlaku meskipun `isPrimary` tidak dikirim atau bernilai `false`.
5. **Set primary tidak mengubah object storage.** Operasi hanya memperbarui metadata `isPrimary` di database.
6. **Delete menghapus object storage terlebih dahulu.** Jika object berhasil dihapus tetapi penghapusan metadata database gagal, service mengembalikan error 500 dan database dapat menyimpan metadata yang menunjuk object yang sudah tidak ada.
7. **Tidak terlihat penggantian primary otomatis saat primary image dihapus.** Repository delete hanya menghapus record image; tidak memilih image pengganti.
8. **Validasi MIME upload awal berasal dari input client.** Saat registrasi, service tetap memeriksa `ContentType` aktual dari object storage.
9. **Response detail schema mengikuti tabel.** File schema `foodImages` tidak disertakan, sehingga daftar kolom lengkap tidak dapat dipastikan hanya dari source module ini.
10. **Prefix router belum diverifikasi.** Contoh request menggunakan `/food-images` sebagai nama prefix yang diasumsikan.

## 8. Source yang tercakup

- `food-images.controller.ts`
- `food-images.repository.ts`
- `food-images.routes.ts`
- `food-images.service.ts`
- `food-images.types.ts`
- `food-images.validation.ts`

Tidak disertakan:
- schema database lengkap `foodImages` dan `foodListings`
- implementasi integrasi R2 (`r2.client.ts`)
- router mount / API entry point
- konfigurasi error handler global
