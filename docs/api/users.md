# SESAJI API — Users Module

> Dokumentasi ini disusun berdasarkan implementasi `src/modules/users/` yang diberikan. Detail yang tidak terlihat pada source module ini—seperti prefix mount router, format error global, dan format autentikasi—tidak diasumsikan.

## 1. Ringkasan

Users module menangani pembacaan profil pengguna yang sedang login dan perubahan data akun/profil miliknya sendiri.

Semua route menggunakan middleware `authenticate` pada level router. Artinya, seluruh endpoint di bawah membutuhkan access token yang valid sesuai implementasi middleware autentikasi aplikasi.

### Endpoint

| Method | Path | Deskripsi | Success status |
|---|---|---|---:|
| GET | `/users/me/profile` | Mengambil data akun, profil role, dan lokasi pengguna | 200 |
| PATCH | `/users/me` | Memperbarui nama lengkap dan/atau nomor telepon | 200 |
| PATCH | `/users/me/profile` | Memperbarui profil berdasarkan role akun | 200 |

Path di atas mengasumsikan router Users dipasang pada prefix `/users`. Prefix mount aktual perlu dikonfirmasi dari entry point aplikasi.

## 2. Autentikasi dan otorisasi

- Router memasang `authenticate` melalui `router.use(authenticate)`.
- User ID diambil dari `req.auth.userId`, bukan dari parameter atau request body.
- Pengguna hanya dapat membaca dan mengubah data akun/profil miliknya sendiri melalui endpoint ini.
- `PATCH /me/profile` memeriksa kecocokan `type` dengan role akun. Ketidaksesuaian menghasilkan `403`.

Format header token dan detail cookie tidak didefinisikan di module Users; ikuti implementasi modul Auth dan middleware `authenticate`.

Contoh header (sesuaikan dengan mekanisme access token aplikasi):

```http
Authorization: Bearer <access_token>
```

## 3. GET `/users/me/profile`

Mengambil data akun, profil spesifik role, serta daftar lokasi yang terhubung ke akun.

### Response sukses — 200

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "fullName": "Nama Pengguna",
      "email": "user@example.com",
      "phoneNumber": "081234567890",
      "role": "DONOR_BUSINESS",
      "accountStatus": "ACTIVE",
      "emailVerifiedAt": "2026-11-23T08:00:00.000Z",
      "phoneVerifiedAt": null,
      "createdAt": "2026-11-20T08:00:00.000Z",
      "updatedAt": "2026-11-23T08:00:00.000Z"
    },
    "profile": {
      "id": "profile-uuid",
      "donorType": "BUSINESS",
      "businessName": "Nama Usaha",
      "businessType": "Restaurant",
      "createdAt": "2026-11-20T08:00:00.000Z",
      "updatedAt": "2026-11-23T08:00:00.000Z"
    },
    "locations": [
      {
        "id": "user-location-uuid",
        "locationId": "location-uuid",
        "locationType": "PICKUP",
        "isDefault": true,
        "address": "Jl. Contoh No. 1",
        "latitude": "-6.200000",
        "longitude": "106.816666",
        "postalCode": "12345",
        "label": "Lokasi utama",
        "createdAt": "2026-11-20T08:00:00.000Z"
      }
    ]
  }
}
```

**Catatan:** Nilai di atas adalah contoh ilustratif untuk menjelaskan struktur, bukan data aktual. Nilai enum dan format serialisasi timestamp/decimal mengikuti schema database dan driver.

### Bentuk `profile` berdasarkan role

#### `DONOR_INDIVIDUAL` dan `DONOR_BUSINESS`

Keduanya mengambil record dari `donorProfiles` dengan field:

```json
{
  "id": "profile-uuid",
  "donorType": "BUSINESS",
  "businessName": "Nama Usaha",
  "businessType": "Restaurant",
  "createdAt": "2026-11-20T08:00:00.000Z",
  "updatedAt": "2026-11-23T08:00:00.000Z"
}
```

Field dapat bernilai `null` apabila memang nullable pada database. Untuk donor individu, `businessName` dan `businessType` dapat tidak berisi nilai sesuai data profil.

#### `RECEIVER`

Profil receiver mengambil field berikut dan menambahkan array `needs`:

```json
{
  "id": "profile-uuid",
  "institutionName": "Nama Institusi",
  "institutionType": "NGO",
  "description": "Deskripsi institusi",
  "capacityPortions": 100,
  "createdAt": "2026-11-20T08:00:00.000Z",
  "updatedAt": "2026-11-23T08:00:00.000Z",
  "needs": [
    {
      "id": "need-uuid",
      "categoryId": "category-uuid",
      "requiredPortions": 50,
      "specialTags": ["HALAL"],
      "notes": "Catatan kebutuhan",
      "isActive": true
    }
  ]
}
```

Field `needs` berasal dari tabel `receiverNeeds` dan hanya diambil ketika record receiver ditemukan.

#### `VOLUNTEER`

```json
{
  "id": "profile-uuid",
  "vehicleType": "Motorcycle",
  "isAvailable": true,
  "preferredRadiusKm": "10",
  "currentLatitude": "-6.200000",
  "currentLongitude": "106.816666",
  "lastLocationAt": "2026-11-23T08:00:00.000Z",
  "createdAt": "2026-11-20T08:00:00.000Z",
  "updatedAt": "2026-11-23T08:00:00.000Z"
}
```

Nilai contoh di atas hanya ilustrasi. Repository memilih field tersebut dari `volunteerProfiles`.

### Bentuk `locations`

Setiap item lokasi memuat:

- `id`: ID relasi user-location (`userLocations.id`)
- `locationId`: ID lokasi (`locations.id`)
- `locationType`
- `isDefault`
- `address`
- `latitude`
- `longitude`
- `postalCode`
- `label`
- `createdAt`: waktu pembuatan relasi user-location

Repository menggunakan inner join `userLocations` ke `locations`. Tidak ada sorting eksplisit pada query ini.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 404 | `User not found` | User ID dari authenticated context tidak ditemukan |

Error diteruskan ke global error handler melalui `next(error)`. Bentuk JSON error final tidak ditentukan oleh controller Users.

## 4. PATCH `/users/me`

Memperbarui data akun pengguna. Field yang dapat diubah hanya `fullName` dan `phoneNumber`.

### Request body

Minimal satu field harus dikirim.

```json
{
  "fullName": "Nama Baru",
  "phoneNumber": "081234567890"
}
```

Contoh hanya mengubah nama:

```json
{
  "fullName": "Nama Baru"
}
```

Contoh menghapus nomor telepon (mengirim `null`):

```json
{
  "phoneNumber": null
}
```

### Validasi

| Field | Tipe | Aturan |
|---|---|---|
| `fullName` | string | Optional; di-trim; minimal 3 karakter; maksimal 255 karakter |
| `phoneNumber` | string atau `null` | Optional; di-trim; jika string minimal 8 dan maksimal 30 karakter |

Ketentuan tambahan:
- Object bersifat `.strict()`: field selain `fullName` dan `phoneNumber` ditolak.
- Minimal satu dari kedua field harus disediakan.
- `phoneNumber: null` diperbolehkan.
- `phoneNumber` tidak dinormalisasi ke format tertentu oleh kode module ini.

### Response sukses — 200

Controller mengembalikan hasil `updateMyAccount`, yang setelah update mengambil ulang profil lengkap melalui `getMyProfile`.

```json
{
  "success": true,
  "message": "Account updated successfully",
  "data": {
    "user": {
      "id": "user-uuid",
      "fullName": "Nama Baru",
      "email": "user@example.com",
      "phoneNumber": "081234567890",
      "role": "DONOR_BUSINESS",
      "accountStatus": "ACTIVE",
      "emailVerifiedAt": "2026-11-23T08:00:00.000Z",
      "phoneVerifiedAt": null,
      "createdAt": "2026-11-20T08:00:00.000Z",
      "updatedAt": "2026-11-23T09:00:00.000Z"
    },
    "profile": {},
    "locations": []
  }
}
```

`profile` dan `locations` pada contoh dipersingkat; bentuk aktual mengikuti role pengguna dan data lokasi seperti pada GET `/users/me/profile`.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 404 | `User not found` | User tidak ditemukan saat update |
| 409 | `Phone number is already registered` | Pelanggaran unique constraint PostgreSQL (`23505`) saat update |

Validasi Zod juga dapat menolak request dengan input tidak valid. Status dan envelope respons validasi mengikuti middleware `validate` dan global error handler, yang tidak disertakan dalam source Users.

## 5. PATCH `/users/me/profile`

Memperbarui data profil berdasarkan role akun yang sedang login.

### Aturan umum

- Body wajib menyertakan `type`.
- `type` harus sama dengan role akun yang sedang login.
- Object bersifat strict; field yang tidak didefinisikan untuk role tersebut ditolak.
- Minimal satu field profil yang dapat diedit harus dikirim, kecuali schema donor individu yang hanya memiliki `type` tetapi kemudian ditolak oleh service.
- Setelah update, service mengambil ulang profil lengkap.

### 5.1 Donor individu

Request schema:

```json
{
  "type": "DONOR_INDIVIDUAL"
}
```

Hasil: request ditolak dengan `400`, message:

```text
Individual donor profile has no editable fields
```

Walaupun object tersebut lolos bentuk schema Zod, service memang menolak update karena profil donor individu belum memiliki field yang dapat diedit.

### 5.2 Donor bisnis

Request body:

```json
{
  "type": "DONOR_BUSINESS",
  "businessName": "Dapur Sejahtera",
  "businessType": "Restaurant"
}
```

Validasi:

| Field | Tipe | Aturan |
|---|---|---|
| `type` | literal | Wajib `DONOR_BUSINESS` |
| `businessName` | string | Optional; trim; 2–255 karakter |
| `businessType` | string | Optional; trim; 2–100 karakter |

Minimal salah satu `businessName` atau `businessType` wajib dikirim.

Repository hanya mengubah field yang nilainya bukan `undefined`, serta mengisi `updatedAt`.

### 5.3 Receiver

Request body:

```json
{
  "type": "RECEIVER",
  "institutionName": "Yayasan Peduli",
  "institutionType": "NGO",
  "description": "Lembaga sosial",
  "capacityPortions": 150
}
```

Validasi:

| Field | Tipe | Aturan |
|---|---|---|
| `type` | literal | Wajib `RECEIVER` |
| `institutionName` | string | Optional; trim; 2–255 karakter |
| `institutionType` | string | Optional; trim; 2–100 karakter |
| `description` | string atau `null` | Optional; trim; maksimal 2000 karakter |
| `capacityPortions` | integer atau `null` | Optional; harus positif |

Minimal salah satu dari empat field profil wajib disediakan.

Repository hanya mengubah field yang bukan `undefined`, serta mengisi `updatedAt`. Endpoint ini tidak mengubah `receiverNeeds`.

### 5.4 Volunteer

Request body:

```json
{
  "type": "VOLUNTEER",
  "vehicleType": "Motorcycle",
  "preferredRadiusKm": 15
}
```

Validasi:

| Field | Tipe | Aturan |
|---|---|---|
| `type` | literal | Wajib `VOLUNTEER` |
| `vehicleType` | string atau `null` | Optional; trim; maksimal 100 karakter |
| `preferredRadiusKm` | number atau `null` | Optional; harus lebih dari 0 dan maksimal 100 |

Minimal salah satu dari `vehicleType` atau `preferredRadiusKm` wajib disediakan.

Repository mengubah `vehicleType` jika dikirim. `preferredRadiusKm` dikonversi menjadi string sebelum disimpan. `updatedAt` juga diperbarui.

**Bukan field yang dapat diubah melalui endpoint ini:** `isAvailable`, `currentLatitude`, `currentLongitude`, dan `lastLocationAt`. Field tersebut hanya muncul pada hasil pembacaan profil volunteer di repository.

### Response sukses — 200

Controller mengembalikan:

```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "user": {},
    "profile": {},
    "locations": []
  }
}
```

Isi `data` adalah hasil pengambilan ulang profil lengkap. Struktur detailnya mengikuti role, sebagaimana dijelaskan pada GET `/users/me/profile`.

### Error yang diketahui

| HTTP status | Message | Kondisi |
|---:|---|---|
| 400 | `Individual donor profile has no editable fields` | Role donor individu mencoba update profil |
| 403 | `Profile type does not match your account role` | `type` request tidak sama dengan role akun |
| 404 | `User not found` | User tidak ditemukan |
| 404 | `User profile not found` | Record profil role tidak ditemukan saat update |

Kesalahan validasi Zod juga mungkin terjadi untuk body yang tidak sesuai schema. Status dan format error validasi mengikuti middleware global.

## 6. Contoh request Bruno

Gunakan environment variable, misalnya:

```text
baseUrl = http://localhost:3000
accessToken = <access-token>
```

Header untuk semua request:

```http
Authorization: Bearer {{accessToken}}
Content-Type: application/json
```

> Sesuaikan `baseUrl` dengan konfigurasi server dan prefix API aktual.

### Get my profile

```http
GET {{baseUrl}}/users/me/profile
Authorization: Bearer {{accessToken}}
```

### Update account

```http
PATCH {{baseUrl}}/users/me
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "fullName": "Nama Baru",
  "phoneNumber": "081234567890"
}
```

### Update business donor profile

```http
PATCH {{baseUrl}}/users/me/profile
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "type": "DONOR_BUSINESS",
  "businessName": "Dapur Sejahtera",
  "businessType": "Restaurant"
}
```

### Update receiver profile

```http
PATCH {{baseUrl}}/users/me/profile
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "type": "RECEIVER",
  "institutionName": "Yayasan Peduli",
  "capacityPortions": 150
}
```

### Update volunteer profile

```http
PATCH {{baseUrl}}/users/me/profile
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "type": "VOLUNTEER",
  "vehicleType": "Motorcycle",
  "preferredRadiusKm": 15
}
```

## 7. Catatan implementasi dan batasan endpoint

Berdasarkan source module:

1. Tidak ada endpoint untuk mengubah email.
2. Tidak ada endpoint untuk mengubah role atau account status.
3. Tidak ada endpoint Users untuk mengelola daftar lokasi; lokasi hanya disertakan pada response profil.
4. `receiverNeeds` hanya dibaca pada GET profil receiver; tidak diperbarui oleh PATCH profil receiver.
5. `isAvailable` dan koordinat volunteer dibaca pada GET, tetapi tidak termasuk field update volunteer.
6. Profil donor individu belum mempunyai field yang dapat diedit.
7. Update nomor telepon menangani PostgreSQL unique violation dengan `409`.
8. `PATCH /me` dan `PATCH /me/profile` mengembalikan profil lengkap setelah update, bukan hanya row yang berubah.

## 8. Hal yang perlu diverifikasi di luar module Users

Source yang diberikan belum mencakup:
- Lokasi pemasangan router Users dan prefix API final.
- Format respons error global dan status untuk kegagalan middleware Zod/auth.
- Format dan masa berlaku access token.
- Nilai enum aktual dan tipe kolom database untuk seluruh field profil.

Untuk memastikan dokumentasi API final konsisten, cocokkan hal-hal tersebut dengan `server.ts`/entry point, middleware `authenticate`, `validate`, error handler, serta schema database.
