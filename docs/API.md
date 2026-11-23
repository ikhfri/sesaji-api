# SESAJI API Documentation

****\*\*Base URL (local):\*\***** `http\://localhost:3000/api/v1`  

****\*\*Content-Type:\*\***** `application/json`  

****\*\*API prefix:\*\***** `/api/v1`

Dokumentasi ini mencakup endpoint yang telah dirancang dan diimplementasikan dalam pengembangan SESAJI API. Status pengujian tiap endpoint tetap perlu dikonfirmasi melalui Bruno pada environment aktif.

---

## 1. Konvensi

### Authentication

Endpoint protected menggunakan:

```http

Authorization: Bearer \<accessToken>

Accept: application/json

Content-Type: application/json

```

Refresh token disimpan dalam cookie `HttpOnly` bernama `sesaji_refresh_token`. Jangan menyimpan refresh token di local storage. Endpoint refresh juga membutuhkan origin dan header CSRF yang sesuai konfigurasi backend.

### Response

Users dan Locations menggunakan pola:

```json

{

  "success": true,

  "message": "Operation completed successfully",

  "data": {}

}

```

Error middleware:

```json

{

  "success": false,

  "message": "Error message"

}

```

| Status | Arti |

|---|---|

| `200` | Berhasil |

| `201` | Resource dibuat |

| `400` | Request/token tidak valid |

| `401` | Tidak terautentikasi atau token tidak valid |

| `403` | Tidak diizinkan, role mismatch, atau email belum diverifikasi |

| `404` | Resource tidak ditemukan/bukan milik user |

| `409` | Konflik data atau operasi tidak dapat dilakukan |

| `503` | Layanan email tidak tersedia |

---

# 2. Authentication API

Base path: `/auth`

## POST `/auth/register`

Mendaftarkan akun dan mengirim email verifikasi. Public endpoint.

Role yang didukung: `DONOR_INDIVIDUAL`, `DONOR_BUSINESS`, `RECEIVER`, `VOLUNTEER`.

### Request — donor individu

```json

{

  "fullName": "Budi Santoso",

  "email": "budi\@example.com",

  "phoneNumber": "081234567890",

  "password": "StrongPassword123",

  "role": "DONOR_INDIVIDUAL",

  "profile": {

    "type": "DONOR_INDIVIDUAL"

  }

}

```

### Request — donor bisnis

```json

{

  "fullName": "Budi Santoso",

  "email": "budi\@example.com",

  "phoneNumber": "081234567890",

  "password": "StrongPassword123",

  "role": "DONOR_BUSINESS",

  "profile": {

    "type": "DONOR_BUSINESS",

    "businessName": "Dapur Sejahtera",

    "businessType": "RESTAURANT"

  }

}

```

### Request — receiver

```json

{

  "fullName": "Siti Aminah",

  "email": "siti\@example.com",

  "password": "StrongPassword123",

  "role": "RECEIVER",

  "profile": {

    "type": "RECEIVER",

    "institutionName": "Panti Asuhan Sejahtera",

    "institutionType": "ORPHANAGE",

    "description": "Lembaga sosial",

    "capacityPortions": 100

  }

}

```

### Request — volunteer

```json

{

  "fullName": "Andi Saputra",

  "email": "andi\@example.com",

  "password": "StrongPassword123",

  "role": "VOLUNTEER",

  "profile": {

    "type": "VOLUNTEER",

    "vehicleType": "MOTORCYCLE"

  }

}

```

****\*\*Validasi:\*\***** nama 3–255 karakter; email valid maksimal 255 karakter; nomor telepon opsional 8–30 karakter; password 12–128 karakter dengan huruf kecil, huruf besar, dan angka; `profile.type` harus sama dengan `role`.

****\*\*Success:\*\***** `201 Created`. Service mengembalikan `userId`, email, dan pesan bahwa verifikasi email diperlukan.

****\*\*Errors:\*\***** `400` body/role/profile tidak valid; `409` email atau nomor telepon sudah terdaftar; `503` akun dibuat tetapi email verifikasi gagal dikirim.

## POST `/auth/login`

Public endpoint.

### Request

```json

{

  "email": "budi\@example.com",

  "password": "StrongPassword123"

}

```

****\*\*Success:\*\***** `200 OK`. Service mengembalikan objek user, `accessToken`, dan `expiresAt`. Refresh token dikirim melalui cookie HttpOnly oleh controller.

****\*\*Errors:\*\***** `400` body tidak valid; `401` email/password salah; `403` email belum diverifikasi atau akun ditangguhkan.

## POST `/auth/refresh`

Menggunakan refresh cookie, bukan Bearer access token.

### Headers

```http

Cookie: sesaji_refresh_token=\<refresh-token>

X-CSRF-Protection: 1

Origin: \<frontend-origin>

```

Body mengikuti schema object kosong:

```json

{}

```

****\*\*Success:\*\***** `200 OK`; access token baru dikembalikan dan refresh cookie dirotasi.  

****\*\*Errors:\*\***** `401` refresh token tidak valid/kedaluwarsa/reuse terdeteksi; `403` origin atau CSRF tidak valid.

## POST `/auth/logout`

Protected endpoint. Mengakhiri session dan menghapus refresh cookie.

****\*\*Success:\*\***** pesan `Logged out successfully`.

## POST `/auth/verify-email`

Public endpoint.

### Request

```json

{

  "token": "<64-character-hex-token>"

}

```

Token mentah berformat 64 karakter hexadecimal. Database menyimpan hash SHA-256 token.

****\*\*Success:\*\*****

```json

{

  "message": "Email verified successfully"

}

```

****\*\*Error:\*\***** `400` token tidak valid, kedaluwarsa, atau sudah digunakan.

## POST `/auth/resend-verification`

Public endpoint.

### Request

```json

{

  "email": "budi\@example.com"

}

```

****\*\*Success:\*\***** `200 OK`, dengan response generik untuk mencegah kebocoran apakah email terdaftar:

```json

{

  "message": "If the account requires verification, a verification email will be sent."

}

```

****\*\*Errors:\*\***** `400` email tidak valid; `503` email gagal dikirim.

## GET `/auth/me`

Protected endpoint. Mengembalikan user aktif: `id`, `fullName`, `email`, `phoneNumber`, `role`, `accountStatus`, `emailVerifiedAt`, `phoneVerifiedAt`, dan `createdAt`.

---

# 3. Users API

Base path: `/users`. Semua endpoint membutuhkan Bearer access token. User hanya dapat mengakses dan mengubah data akunnya sendiri.

## GET `/users/me/profile`

Mengambil data akun, profil sesuai role, lokasi user, dan receiver needs jika user adalah receiver.

****\*\*Success:\*\***** `200 OK`.

Struktur data utama:

```json

{

  "success": true,

  "message": "Profile retrieved successfully",

  "data": {

    "user": {

      "id": "\<uuid>",

      "fullName": "Budi Santoso",

      "email": "budi\@example.com",

      "phoneNumber": "081234567890",

      "role": "DONOR_INDIVIDUAL",

      "accountStatus": "PENDING",

      "emailVerifiedAt": null,

      "phoneVerifiedAt": null,

      "createdAt": "\<timestamp>",

      "updatedAt": "\<timestamp>"

    },

    "profile": {},

    "locations": []

  }

}

```

`profile` mengikuti role: donor, receiver (termasuk `needs`), volunteer, atau `null` jika tidak memiliki profil khusus. `passwordHash` tidak dikembalikan.

## PATCH `/users/me`

Mengubah nama dan/atau nomor telepon.

### Request

```json

{

  "fullName": "Budi Santoso",

  "phoneNumber": "081234567890"

}

```

| Field | Tipe | Aturan |

|---|---|---|

| `fullName` | string | Opsional, 3–255 karakter |

| `phoneNumber` | string/null | Opsional, 8–30 karakter jika string |

Minimal satu field harus dikirim. Field tambahan ditolak.

****\*\*Errors:\*\***** `400` body kosong/invalid; `404` user tidak ditemukan; `409` nomor telepon sudah digunakan.

## PATCH `/users/me/profile`

Mengubah profil sesuai role akun. Field tambahan ditolak.

### Donor bisnis

```json

{

  "type": "DONOR_BUSINESS",

  "businessName": "Dapur Sejahtera",

  "businessType": "RESTAURANT"

}

```

`businessName`: opsional 2–255 karakter. `businessType`: opsional 2–100 karakter. Minimal salah satu field profil dikirim.

### Receiver

```json

{

  "type": "RECEIVER",

  "institutionName": "Panti Asuhan Sejahtera",

  "institutionType": "ORPHANAGE",

  "description": "Lembaga sosial",

  "capacityPortions": 100

}

```

`institutionName`: opsional 2–255 karakter. `institutionType`: opsional 2–100 karakter. `description`: opsional/null maksimal 2.000 karakter. `capacityPortions`: opsional/null integer positif. Minimal salah satu field profil dikirim.

### Volunteer

```json

{

  "type": "VOLUNTEER",

  "vehicleType": "MOTORCYCLE",

  "preferredRadiusKm": 10

}

```

`vehicleType`: opsional/null maksimal 100 karakter. `preferredRadiusKm`: opsional, lebih dari 0 dan maksimal 100. Minimal salah satu field profil dikirim.

### Donor individu

Belum memiliki field profil yang dapat diedit melalui endpoint ini; request `DONOR_INDIVIDUAL` menghasilkan `400`.

****\*\*Errors:\*\***** `400` field invalid atau donor individu; `403` jenis profil tidak sesuai role; `404` user/profil tidak ditemukan.

`isAvailable` dan koordinat volunteer belum diperbarui melalui endpoint ini.

---

# 4. Locations API

Base path: `/locations`. Semua endpoint membutuhkan Bearer access token. `userId` berasal dari access token, bukan request body.

## GET `/locations/me`

Mengambil semua lokasi milik user.

****\*\*Success:\*\***** `200 OK`.

```json

{

  "success": true,

  "message": "Locations retrieved successfully",

  "data": [

    {

      "id": "\<user-location-uuid>",

      "locationId": "\<location-uuid>",

      "locationType": "HOME",

      "isDefault": true,

      "address": "Jl. Contoh No. 10",

      "latitude": -6.2,

      "longitude": 106.8,

      "postalCode": "12345",

      "label": "Rumah",

      "createdAt": "\<timestamp>"

    }

  ]

}

```

`id` adalah ID relasi `user_locations`; `locationId` adalah ID record `locations`. Gunakan `id` sebagai parameter `:id`.

## POST `/locations/me`

Membuat lokasi dan relasi user-location dalam satu transaksi.

### Request

```json

{

  "address": "Jl. Contoh No. 10, Depok",

  "latitude": -6.4,

  "longitude": 106.8,

  "postalCode": "16412",

  "label": "Rumah",

  "locationType": "HOME",

  "isDefault": true

}

```

| Field | Tipe | Aturan |

|---|---|---|

| `address` | string | Wajib, 5–2.000 karakter |

| `latitude` | number | Wajib, -90 sampai 90 |

| `longitude` | number | Wajib, -180 sampai 180 |

| `postalCode` | string | Opsional, maksimal 20 karakter |

| `label` | string | Opsional, maksimal 100 karakter |

| `locationType` | string | Wajib, 2–100 karakter |

| `isDefault` | boolean | Opsional |

Aturan default:

- Lokasi pertama otomatis menjadi default.

- `isDefault: true` menjadikan lokasi baru sebagai default dan menonaktifkan default sebelumnya.

- Jika user sudah memiliki default dan `isDefault` tidak dikirim/false, lokasi baru bukan default.

****\*\*Success:\*\***** `201 Created`.

## PATCH `/locations/me/:id`

Mengubah lokasi milik user. `:id` adalah ID relasi `user_locations`.

### Request

```json

{

  "address": "Jl. Contoh Baru No. 20, Depok",

  "latitude": -6.41,

  "longitude": 106.81,

  "postalCode": "16412",

  "label": "Rumah utama",

  "locationType": "HOME"

}

```

Semua field opsional, tetapi minimal satu harus dikirim. Jika koordinat diperbarui, `latitude` dan `longitude` wajib dikirim bersama.

****\*\*Errors:\*\***** `400` body tidak valid; `404` lokasi tidak ditemukan atau bukan milik user.

## PATCH `/locations/me/:id/default`

Menjadikan lokasi sebagai default. Tidak membutuhkan request body.

****\*\*Success:\*\***** `200 OK`.  

****\*\*Error:\*\***** `404` lokasi tidak ditemukan atau bukan milik user.

## DELETE `/locations/me/:id`

Menghapus relasi lokasi dari user. Record pada tabel `locations` tidak otomatis dihapus.

****\*\*Success:\*\***** response berisi ID relasi dan pesan `Location deleted successfully`.  

****\*\*Errors:\*\***** `404` lokasi tidak ditemukan/bukan milik user; `409` lokasi masih default. Tetapkan lokasi lain sebagai default terlebih dahulu.

---

# 5. Endpoint Summary

| Module | Method | Endpoint | Authentication |

|---|---|---|---|

| Auth | POST | `/auth/register` | Public |

| Auth | POST | `/auth/login` | Public |

| Auth | POST | `/auth/refresh` | Refresh cookie + CSRF |

| Auth | POST | `/auth/logout` | Protected |

| Auth | POST | `/auth/verify-email` | Public |

| Auth | POST | `/auth/resend-verification` | Public |

| Auth | GET | `/auth/me` | Bearer |

| Users | GET | `/users/me/profile` | Bearer |

| Users | PATCH | `/users/me` | Bearer |

| Users | PATCH | `/users/me/profile` | Bearer |

| Locations | GET | `/locations/me` | Bearer |

| Locations | POST | `/locations/me` | Bearer |

| Locations | PATCH | `/locations/me/:id` | Bearer |

| Locations | PATCH | `/locations/me/:id/default` | Bearer |

| Locations | DELETE | `/locations/me/:id` | Bearer |

---

---

# 5. Regions API

Base path: `/regions`.

Endpoint baca bersifat public. Endpoint perubahan data hanya untuk `ADMIN`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| GET | `/regions` | Public | Daftar wilayah |

| GET | `/regions/:id` | Public | Detail wilayah |

| GET | `/regions/:id/children` | Public | Subwilayah |

| POST | `/regions` | ADMIN | Membuat wilayah |

| PATCH | `/regions/:id` | ADMIN | Mengubah wilayah |

| DELETE | `/regions/:id` | ADMIN | Menghapus wilayah |

Data wilayah menggunakan relasi parent-child. Penghapusan wilayah ditolak jika masih memiliki child region. Parent tidak boleh membentuk siklus dan nama/jenis wilayah divalidasi oleh service.

---

# 6. Food Listings API

Base path: `/food-listings`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| GET | `/food-listings/explore` | Public | Menjelajahi listing aktif |

| GET | `/food-listings/categories` | Public | Kategori makanan aktif |

| GET | `/food-listings/:id` | Public | Detail listing |

| GET | `/food-listings/me` | Donor | Listing milik donor |

| POST | `/food-listings` | Donor | Membuat listing |

| PATCH | `/food-listings/:id` | Donor pemilik | Mengubah listing |

| DELETE | `/food-listings/:id` | Donor pemilik | Menutup listing |

Aturan bisnis:

- Donor individu harus memiliki email terverifikasi, maksimal 3 listing aktif dan maksimal 20 porsi per listing.

- Donor bisnis harus memiliki verifikasi `DONOR_BUSINESS` berstatus `APPROVED`.

- Listing yang dapat dijelajahi harus aktif, memiliki stok tersedia, dan belum melewati pickup deadline.

- Perubahan stok tersedia dilakukan melalui alur Food Requests, bukan dengan mengubah stok secara bebas.

- Listing tidak dapat ditutup jika masih memiliki request yang belum selesai sesuai aturan service.

Nama kategori mengacu pada tabel `food_categories`.

---

# 7. Food Requests API

Base path: `/food-requests`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| POST | `/food-requests` | RECEIVER | Mengajukan permintaan makanan |

| GET | `/food-requests/me` | RECEIVER | Permintaan yang dibuat |

| GET | `/food-requests/incoming` | Donor | Permintaan masuk ke listing donor |

| GET | `/food-requests/:id` | Pihak terkait | Detail permintaan |

| PATCH | `/food-requests/:id/respond` | Donor pemilik listing | Menyetujui/menolak permintaan |

| PATCH | `/food-requests/:id/cancel` | Receiver pemilik request | Membatalkan request yang masih pending |

Aturan bisnis:

- Receiver harus memiliki verifikasi `RECEIVER` berstatus `APPROVED`.

- Receiver tidak dapat meminta listing miliknya sendiri.

- Request harus mengacu pada listing aktif dan pickup deadline yang belum lewat.

- Request berstatus `PENDING` belum mengurangi stok.

- Ketika donor menyetujui request, stok dikurangi secara transaksional dan status listing dapat berubah menjadi `FULLY_RESERVED` jika stok habis.

- Request yang sudah disetujui tidak dapat dibatalkan melalui endpoint cancel yang hanya menerima status pending.

Contoh request:

```json

{

  "listingId": "\<listing-uuid>",

  "requestedPortions": 10,

  "fulfillmentMethod": "VOLUNTEER_DELIVERY",

  "recipientNotes": "Mohon hubungi petugas penerima saat tiba."

}

```

Field request harus mengikuti schema validasi aktual. Nilai `fulfillmentMethod` yang digunakan dalam alur pengiriman adalah `SELF_PICKUP` atau `VOLUNTEER_DELIVERY`.

---

# 8. Food Images API

Base path: `/food-images`.

Upload menggunakan presigned URL ke Cloudflare R2. Proses upload terdiri dari meminta URL, mengunggah file langsung ke object storage, lalu mendaftarkan metadata ke API.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| POST | `/food-images/upload-url` | Donor | Meminta presigned upload URL |

| POST | `/food-images` | Donor pemilik listing | Mendaftarkan metadata gambar |

| GET | `/food-images/listing/:listingId` | Public | Daftar gambar listing |

| PATCH | `/food-images/:id/primary` | Donor pemilik listing | Menetapkan gambar utama |

| DELETE | `/food-images/:id` | Donor pemilik listing | Menghapus gambar |

Ketentuan:

- Format yang didukung: JPEG, PNG, dan WebP.

- Ukuran maksimum: 5 MB per gambar.

- Maksimum 5 gambar per listing.

- Gambar pertama otomatis menjadi gambar utama.

- API memeriksa metadata object storage sebelum metadata gambar didaftarkan.

Contoh alur upload:

1. Panggil endpoint upload URL dengan `listingId`, `filename`, dan `contentType` sesuai schema aktual.

2. Kirim `PUT` ke `uploadUrl` menggunakan binary file dan content type yang sesuai.

3. Panggil endpoint registrasi metadata menggunakan object key/URL yang dikembalikan service.

---

# 9. Verifications API

Base path: `/verifications`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| POST | `/verifications/upload-url` | User sesuai jenis verifikasi | Meminta URL upload dokumen |

| POST | `/verifications` | Donor bisnis / receiver / volunteer | Mengirim pengajuan verifikasi |

| GET | `/verifications/me` | User | Melihat pengajuan sendiri |

| GET | `/verifications/:id` | Pemilik / ADMIN | Detail verifikasi |

| GET | `/verifications/admin` | ADMIN | Daftar pengajuan verifikasi |

| PATCH | `/verifications/:id/approve` | ADMIN | Menyetujui pengajuan |

| PATCH | `/verifications/:id/reject` | ADMIN | Menolak pengajuan |

| GET | `/verifications/:id/documents/:documentId/url` | Pemilik / ADMIN | Meminta signed download URL |

Jenis verifikasi:

- `DONOR_BUSINESS`

- `RECEIVER`

- `VOLUNTEER`

Status:

- `PENDING`

- `APPROVED`

- `REJECTED`

Pengajuan baru tidak dapat dibuat jika user sudah memiliki pengajuan `PENDING` atau `APPROVED`. Pengajuan yang ditolak dapat diajukan ulang.

****Catatan keamanan storage:**** dokumen verifikasi harus disimpan di private bucket dan diakses menggunakan signed URL. Jangan menganggap dokumen privat jika masih berada di bucket publik yang sama dengan gambar makanan.

---

# 10. Notifications API

Base path: `/notifications`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| GET | `/notifications` | Bearer | Daftar notifikasi |

| GET | `/notifications/unread-count` | Bearer | Jumlah notifikasi belum dibaca |

| PATCH | `/notifications/read-all` | Bearer | Menandai semua sebagai dibaca |

| PATCH | `/notifications/:id/read` | Pemilik notifikasi | Menandai satu notifikasi sebagai dibaca |

| DELETE | `/notifications/:id` | Pemilik notifikasi | Menghapus notifikasi |

Notifikasi disimpan per user. Push notification dikirim secara best-effort melalui Firebase Cloud Messaging jika device token tersedia. Kegagalan pengiriman push tidak seharusnya membatalkan penyimpanan notifikasi database.

Jenis notifikasi yang telah disiapkan meliputi `NEW_FOOD_REQUEST`, `REQUEST_APPROVED`, `REQUEST_REJECTED`, `NEW_DELIVERY_TASK`, `DELIVERY_STATUS_UPDATED`, `DONATION_COMPLETED`, `LISTING_EXPIRING`, `VERIFICATION_APPROVED`, `VERIFICATION_REJECTED`, dan `SYSTEM`.

---

# 11. Device Tokens API

Base path: `/device-tokens`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| POST | `/device-tokens` | Bearer | Mendaftarkan atau memperbarui device token |

| DELETE | `/device-tokens` | Bearer | Mencabut device token |

Platform yang didukung oleh schema: `ANDROID` dan `WEB`. Token terhubung dengan user yang sedang terautentikasi. Token yang tidak valid dapat ditandai revoked oleh proses pengiriman FCM.

Bentuk body harus mengikuti `device-tokens.validation.ts` pada branch aktif.

---

# 12. Pickup Schedules API

Base path: `/pickup-schedules`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| POST | `/pickup-schedules` | Donor pemilik request | Membuat jadwal pickup |

| GET | `/pickup-schedules/me` | Pihak terkait | Daftar jadwal milik user |

| GET | `/pickup-schedules/:id` | Pihak terkait | Detail jadwal |

| PATCH | `/pickup-schedules/:id` | Donor pemilik request | Mengubah jadwal |

| DELETE | `/pickup-schedules/:id` | Donor pemilik request | Menghapus jadwal |

Aturan:

- Jadwal terkait dengan satu Food Request.

- Request harus berstatus `APPROVED`.

- Waktu selesai harus lebih besar daripada waktu mulai.

- Jadwal tidak boleh melewati pickup deadline listing.

- Sistem membuat handover code 4 digit untuk konfirmasi serah terima.

Jika fulfillment menggunakan `VOLUNTEER_DELIVERY`, pembuatan delivery task perlu terintegrasi dengan pembuatan pickup schedule. Pastikan integrasi ini sudah aktif pada repository branch sebelum mengandalkan perilaku tersebut.

---

# 13. Delivery Tasks API

Base path: `/delivery-tasks`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| GET | `/delivery-tasks/available` | VOLUNTEER | Daftar task yang tersedia |

| GET | `/delivery-tasks/me` | VOLUNTEER | Task milik volunteer |

| GET | `/delivery-tasks/:id` | Bearer, dengan pemeriksaan akses | Detail task |

| POST | `/delivery-tasks/:id/claim` | VOLUNTEER | Mengambil task |

| PATCH | `/delivery-tasks/:id/status` | VOLUNTEER pemilik task | Memperbarui status pengiriman |

| POST | `/delivery-tasks/:id/confirm-handover` | RECEIVER pemilik request | Mengonfirmasi serah terima |

Siklus status task:

`OPEN` → `ASSIGNED` → `PICKED_UP` → `DELIVERED` → `COMPLETED`.

Status tambahan yang tersedia pada schema: `CANCELLED` dan `EXPIRED`.

Ketentuan:

- Volunteer harus memiliki profil dan verifikasi volunteer yang disetujui serta status ketersediaan aktif untuk mengambil task.

- Claim task dilakukan secara transaksional agar dua volunteer tidak mengambil task yang sama.

- Volunteer hanya dapat memperbarui task yang menjadi miliknya.

- Perubahan menjadi `PICKED_UP` mengubah Food Request dari `APPROVED` menjadi `IN_PROGRESS`.

- Receiver pemilik request mengonfirmasi handover menggunakan kode 4 digit.

- Konfirmasi berhasil mengubah Food Request menjadi `COMPLETED` dan Delivery Task menjadi `COMPLETED`.

Contoh update status:

```json

{

  "status": "PICKED_UP",

  "proofImageUrl": "https\://example.com/proof.jpg",

  "notes": "Makanan telah diterima dari donor."

}

```

Contoh konfirmasi serah terima:

```json

{

  "handoverCode": "1234"

}

```

Nilai status dan field body harus mengikuti validation pada branch aktif.

---

# 14. Donation Histories API

Base path: `/donation-histories`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| GET | `/donation-histories/me` | Donor / receiver / volunteer / ADMIN | Riwayat sesuai peran |

| GET | `/donation-histories/:id` | Pihak terkait / ADMIN | Detail riwayat |

Data berasal dari PostgreSQL view `public.donation_histories`, bukan tabel terpisah. View menggabungkan Food Request, Food Listing, donor, receiver, kategori, pickup schedule, dan delivery task.

Filter daftar:

- `page`

- `limit`

- `status` — status Food Request.

Akses dibatasi berdasarkan identitas:

- Donor melihat riwayat dengan `donor_id` miliknya.

- Receiver melihat riwayat dengan `recipient_id` miliknya.

- Volunteer melihat riwayat dengan `volunteer_id` miliknya.

- Admin dapat melihat seluruh riwayat.

Data view mencerminkan status transaksi terkini; bukan snapshot immutable pada waktu transaksi selesai.

---

# 15. Food Reports API

Base path: `/food-reports`.

| Method | Endpoint | Akses | Fungsi |

|---|---|---|---|

| POST | `/food-reports` | Bearer | Membuat laporan |

| GET | `/food-reports/me` | Bearer | Daftar laporan sendiri |

| GET | `/food-reports/:id` | Pelapor / ADMIN | Detail laporan |

| GET | `/food-reports/admin` | ADMIN | Daftar seluruh laporan |

| PATCH | `/food-reports/:id/review` | ADMIN | Memulai review |

| PATCH | `/food-reports/:id/resolve` | ADMIN | Menyelesaikan laporan |

| PATCH | `/food-reports/:id/reject` | ADMIN | Menolak laporan |

Jenis laporan:

- `UNSAFE_FOOD`

- `FOOD_QUALITY`

- `DELIVERY_ISSUE`

- `MISCONDUCT`

- `OTHER`

Status laporan:

`PENDING` → `REVIEWING` → `RESOLVED` atau `REJECTED`.

Contoh membuat laporan:

```json

{

  "listingId": "\<listing-uuid>",

  "type": "UNSAFE_FOOD",

  "description": "Makanan memiliki bau tidak normal dan diduga sudah tidak layak dikonsumsi.",

  "evidenceImageUrls": []

}

```

Field opsional `requestId` dan `deliveryTaskId` dapat menyertakan konteks transaksi terkait. Jika digunakan, service memeriksa hubungan request/task dengan listing dan keterlibatan pelapor.

Contoh memulai review:

```json

{

  "notes": "Laporan diterima dan sedang diperiksa."

}

```

Contoh menyelesaikan atau menolak laporan:

```json

{

  "resolutionNotes": "Laporan telah diperiksa dan tindakan penanganan telah dilakukan."

}

```

Pelapor hanya dapat membaca laporannya sendiri. Admin dapat membaca dan mengelola seluruh laporan. Transisi status dikunci dalam transaksi agar dua admin tidak mengubah laporan yang sama secara bersamaan.

---

# 16. Updated Endpoint Summary

| Module | Method | Endpoint | Authentication |

|---|---|---|---|

| Auth | POST | `/auth/register` | Public |

| Auth | POST | `/auth/login` | Public |

| Auth | POST | `/auth/refresh` | Refresh cookie + CSRF |

| Auth | POST | `/auth/logout` | Bearer |

| Auth | POST | `/auth/verify-email` | Public |

| Auth | POST | `/auth/resend-verification` | Public |

| Auth | GET | `/auth/me` | Bearer |

| Users | GET | `/users/me/profile` | Bearer |

| Users | PATCH | `/users/me` | Bearer |

| Users | PATCH | `/users/me/profile` | Bearer |

| Locations | GET | `/locations/me` | Bearer |

| Locations | POST | `/locations/me` | Bearer |

| Locations | PATCH | `/locations/me/:id` | Bearer |

| Locations | PATCH | `/locations/me/:id/default` | Bearer |

| Locations | DELETE | `/locations/me/:id` | Bearer |

| Regions | GET | `/regions` | Public |

| Regions | GET | `/regions/:id` | Public |

| Regions | GET | `/regions/:id/children` | Public |

| Regions | POST/PATCH/DELETE | `/regions` and `/regions/:id` | ADMIN |

| Food Listings | GET | `/food-listings/explore` | Public |

| Food Listings | GET | `/food-listings/categories` | Public |

| Food Listings | GET | `/food-listings/:id` | Public |

| Food Listings | GET | `/food-listings/me` | Donor |

| Food Listings | POST | `/food-listings` | Donor |

| Food Listings | PATCH/DELETE | `/food-listings/:id` | Donor pemilik |

| Food Requests | POST | `/food-requests` | RECEIVER |

| Food Requests | GET | `/food-requests/me` | RECEIVER |

| Food Requests | GET | `/food-requests/incoming` | Donor |

| Food Requests | GET | `/food-requests/:id` | Pihak terkait |

| Food Requests | PATCH | `/food-requests/:id/respond` | Donor pemilik |

| Food Requests | PATCH | `/food-requests/:id/cancel` | RECEIVER pemilik |

| Food Images | POST | `/food-images/upload-url` | Donor |

| Food Images | POST | `/food-images` | Donor pemilik |

| Food Images | GET | `/food-images/listing/:listingId` | Public |

| Food Images | PATCH | `/food-images/:id/primary` | Donor pemilik |

| Food Images | DELETE | `/food-images/:id` | Donor pemilik |

| Verifications | POST | `/verifications/upload-url` | User sesuai role |

| Verifications | POST | `/verifications` | User sesuai role |

| Verifications | GET | `/verifications/me` | Bearer |

| Verifications | GET | `/verifications/:id` | Pemilik / ADMIN |

| Verifications | GET | `/verifications/admin` | ADMIN |

| Verifications | PATCH | `/verifications/:id/approve` | ADMIN |

| Verifications | PATCH | `/verifications/:id/reject` | ADMIN |

| Verifications | GET | `/verifications/:id/documents/:documentId/url` | Pemilik / ADMIN |

| Notifications | GET | `/notifications` | Bearer |

| Notifications | GET | `/notifications/unread-count` | Bearer |

| Notifications | PATCH | `/notifications/read-all` | Bearer |

| Notifications | PATCH | `/notifications/:id/read` | Pemilik |

| Notifications | DELETE | `/notifications/:id` | Pemilik |

| Device Tokens | POST/DELETE | `/device-tokens` | Bearer |

| Pickup Schedules | POST | `/pickup-schedules` | Donor pemilik request |

| Pickup Schedules | GET | `/pickup-schedules/me` | Pihak terkait |

| Pickup Schedules | GET | `/pickup-schedules/:id` | Pihak terkait |

| Pickup Schedules | PATCH/DELETE | `/pickup-schedules/:id` | Donor pemilik request |

| Delivery Tasks | GET | `/delivery-tasks/available` | VOLUNTEER |

| Delivery Tasks | GET | `/delivery-tasks/me` | VOLUNTEER |

| Delivery Tasks | GET | `/delivery-tasks/:id` | Bearer + access check |

| Delivery Tasks | POST | `/delivery-tasks/:id/claim` | VOLUNTEER |

| Delivery Tasks | PATCH | `/delivery-tasks/:id/status` | VOLUNTEER pemilik |

| Delivery Tasks | POST | `/delivery-tasks/:id/confirm-handover` | RECEIVER pemilik |

| Donation Histories | GET | `/donation-histories/me` | Bearer |

| Donation Histories | GET | `/donation-histories/:id` | Pihak terkait / ADMIN |

| Food Reports | POST | `/food-reports` | Bearer |

| Food Reports | GET | `/food-reports/me` | Bearer |

| Food Reports | GET | `/food-reports/:id` | Pelapor / ADMIN |

| Food Reports | GET | `/food-reports/admin` | ADMIN |

| Food Reports | PATCH | `/food-reports/:id/review` | ADMIN |

| Food Reports | PATCH | `/food-reports/:id/resolve` | ADMIN |

| Food Reports | PATCH | `/food-reports/:id/reject` | ADMIN |

---

# 17. Implementation and Verification Notes

- Dokumentasi ini disusun dari dokumentasi awal dan detail implementasi yang telah dibahas. Cocokkan path, nama field, schema body, dan middleware dengan route/controller aktual sebelum menjadikannya kontrak final.

- Typecheck dan build terbaru dilaporkan berhasil pada 23 November 2026 setelah implementasi Impact Dashboard. Hal tersebut tidak berarti semua endpoint telah diuji melalui Bruno.

- Pengujian Bruno untuk Users, Locations, dan beberapa modul transaksi masih perlu dilakukan atau dikonfirmasi.

- Konfigurasi private bucket untuk dokumen verifikasi perlu dipastikan sebelum production. Dokumen identitas tidak boleh disajikan melalui public object URL.

- Validasi ownership dan akses detail perlu diuji dengan akun lintas role, terutama untuk Food Reports, Delivery Tasks, Pickup Schedules, dan Verifications.

- Donation Histories membaca database view dan bukan arsip snapshot yang immutable.

- Integrasi notifikasi pada seluruh transisi bisnis dan push notification masih perlu diverifikasi melalui pengujian end-to-end.

- Endpoint upload menggunakan presigned URL memerlukan pengujian terpisah terhadap storage, ukuran file, content type, dan ownership.

- Pastikan migration, typecheck, build, dan route mounting branch aktif lolos sebelum dokumentasi dianggap sepenuhnya sinkron.

- Untuk dokumentasi API final, response body dan error codes perlu dibandingkan langsung dengan controller dan service aktual.

---

# 6. Bruno Environment

Environment `Local`:

```json

{

  "baseUrl": "http\://localhost:3000/api/v1",

  "accessToken": ""

}

```

Contoh URL:

```text

{{baseUrl}}/auth/login

{{baseUrl}}/users/me/profile

{{baseUrl}}/locations/me

```

Untuk endpoint protected:

```http

Authorization: Bearer {{accessToken}}

Accept: application/json

Content-Type: application/json

```

Refresh perlu mengirim refresh cookie dan header origin/CSRF sesuai konfigurasi backend.

---

# 7. Implementation Notes

- Dokumentasi endpoint telah diperluas ke Regions, Food Listings, Food Requests, Food Images, Verifications, Notifications, Device Tokens, Pickup Schedules, Delivery Tasks, Donation Histories, dan Food Reports. Endpoint yang belum dikonfirmasi melalui route aktual diberi catatan untuk diverifikasi.

- Pengujian Bruno untuk User Management dan Location Management masih ditunda.

- Frontend verifikasi email belum diuji end-to-end. Backend mengirim link ke `FRONTEND_URL` dengan query parameter `token`.

- Donor individu belum memiliki field profil yang dapat diedit melalui `PATCH /users/me/profile`.

- `receiverNeeds` dibaca pada response profil receiver, tetapi CRUD receiver needs belum termasuk endpoint Users.

- `isAvailable` dan pembaruan koordinat volunteer belum memiliki endpoint khusus.

- `user_locations.is_default` menjadi sumber utama lokasi default. Pointer `defaultUserLocationId` pada profil donor/receiver disinkronkan saat lokasi default dibuat atau diganti pada implementasi repository.

- Pastikan migration, typecheck, dan build branch aktif lolos sebelum dokumen dianggap sepenuhnya sinkron.

- Bentuk response Auth perlu dicocokkan kembali dengan controller Auth aktual sebelum dijadikan kontrak OpenAPI final.

---

# 18. Smart Food Matching API

Base path: `/food-matching`.

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/food-matching/recommendations` | RECEIVER | Mendapatkan rekomendasi listing makanan berdasarkan kebutuhan dan lokasi receiver |

Fitur matching melakukan penyaringan listing yang memenuhi syarat, kemudian memberi peringkat berdasarkan faktor jarak, kecukupan porsi, sisa waktu pickup, kecocokan kategori, dan kebutuhan khusus receiver.

Catatan implementasi:
- Rekomendasi menggunakan lokasi default receiver.
- Listing yang tidak aktif, tidak memiliki stok tersedia, atau telah melewati pickup deadline tidak menjadi kandidat.
- Perhitungan jarak menggunakan koordinat lokasi dan pendekatan Haversine.
- Estimasi waktu tempuh merupakan pendekatan, bukan estimasi navigasi/rute real-time.
- Skor rekomendasi bersifat ranking internal dan bukan jaminan listing akan tersedia saat receiver mengajukan request.
- Nama parameter query, struktur response, dan batas radius harus dicocokkan dengan validation/controller pada branch aktif sebelum dijadikan kontrak final.

---

# 19. Impact API

Base path: `/impact`.

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/impact/admin` | ADMIN | Dashboard dampak dan metrik operasional platform (IMP-01) |
| GET | `/impact/food` | ADMIN | Food Impact Tracker: estimasi makanan terselamatkan dan dampak lingkungan (IMP-02) |
| GET | `/impact/me` | DONOR_INDIVIDUAL / DONOR_BUSINESS / RECEIVER / VOLUNTEER | Statistik dampak personal sesuai role (IMP-03) |

## IMP-01 — Admin Impact Dashboard

Menyediakan agregasi metrik platform, termasuk:
- Jumlah donasi selesai.
- Total porsi makanan yang didistribusikan.
- Rata-rata waktu distribusi.
- Jumlah user aktif berdasarkan role donor, receiver, dan volunteer.
- Total food requests dan fulfillment rate.

## IMP-02 — Food Impact Tracker

Menyediakan:
- Ringkasan donasi selesai dan total porsi.
- Breakdown berdasarkan kategori makanan.
- Tren bulanan selama 12 bulan.
- Estimasi berat makanan terselamatkan (kg).
- Estimasi rentang emisi CO₂e yang dihindari.

Estimasi dampak menggunakan konfigurasi faktor rata-rata porsi dan faktor emisi. Nilai yang ditampilkan merupakan estimasi berbasis asumsi/metodologi, bukan hasil penimbangan atau pengukuran emisi aktual. Sumber, faktor, dan disclaimer metodologi harus ditampilkan dari konfigurasi service agar dapat ditinjau dan diperbarui.

## IMP-03 — Personal Impact

Response disesuaikan dengan role:
- Donor: jumlah donasi selesai, total porsi, rata-rata waktu penyelesaian, dan tren 30 hari.
- Receiver: jumlah request selesai, total porsi diterima, rata-rata waktu penyelesaian, dan tren 30 hari.
- Volunteer: jumlah pengiriman selesai, total porsi, rata-rata waktu pengiriman, dan tren 30 hari.

Semua metrik personal dibatasi berdasarkan identitas user yang sedang terautentikasi.

---

# 20. Background Jobs

## Food Listing Expiration Scheduler

Job berkala memeriksa listing yang melewati pickup deadline dan memperbarui status listing serta request terkait sesuai aturan expiration.

Catatan:
- Scheduler dijalankan oleh proses API setelah koneksi database berhasil.
- Interval yang digunakan pada implementasi saat ini adalah 60 detik.
- Pastikan job tidak berjalan ganda ketika deployment menggunakan lebih dari satu instance API.
- Perilaku notifikasi yang dipicu oleh expiration perlu diverifikasi secara terpisah.

---

# 21. Current Implementation & Verification Status

Status berikut merupakan catatan progres pengembangan, bukan klaim bahwa semua endpoint telah lulus acceptance test.

| Area | Status pengembangan | Status verifikasi |
|---|---|---|
| Authentication & RBAC | Implemented | Perlu regression test menyeluruh |
| Users, Profiles, Locations, Regions | Implemented | Sebagian pengujian Bruno perlu dikonfirmasi |
| Food Listings & Food Requests | Implemented | Perlu E2E dan concurrency test |
| Food Images (Cloudflare R2) | Implemented | Perlu uji upload, metadata, ownership, dan batas ukuran |
| Verifications | Implemented | Keamanan private bucket dan signed URL perlu dipastikan |
| Notifications & Device Tokens | Implemented | Integrasi event dan push perlu diuji |
| Pickup Schedules & Delivery Tasks | Implemented | Perlu uji alur lintas role dan concurrency claim |
| Donation Histories & Food Reports | Implemented | Perlu regression/ownership test |
| Listing Expiration Scheduler | Implemented | Perlu uji restart, multi-instance, dan efek notifikasi |
| Smart Food Matching | Implemented | Perlu validasi hasil rekomendasi dengan data nyata |
| IMP-01, IMP-02, IMP-03 | Implemented | Typecheck dan build berhasil; pengujian Bruno belum dikonfirmasi |

## Hasil pemeriksaan terbaru

Pada 23 November 2026, perintah berikut berhasil dijalankan tanpa error:

```bash
npm run typecheck && npm run build
```

Hasil:
- `npm run typecheck` — PASS (`tsc --noEmit`).
- `npm run build` — PASS (`tsc`).

Hasil tersebut memverifikasi kompilasi TypeScript, bukan kebenaran seluruh perilaku runtime atau akses endpoint.

## Pekerjaan lanjutan yang direkomendasikan

1. Pengujian Bruno untuk seluruh endpoint dan role.
2. Integrasi notifikasi untuk setiap transisi Food Requests, Pickup Schedules, Delivery Tasks, dan expiration.
3. Audit authorization, ownership/IDOR, dan role bypass.
4. Pastikan dokumen verifikasi berada di private object storage dan hanya diakses melalui signed URL.
5. Integration dan concurrency test untuk reservasi stok serta claim delivery task.
6. End-to-end test: donor membuat listing → receiver request → donor approve → pickup/delivery → receiver konfirmasi handover → impact metrics diperbarui.
7. Verifikasi deployment, backup/restore, scheduler behavior, dan observability sebelum production.

---

# 22. Documentation Maintenance

- Dokumentasi ini merangkum endpoint dan perilaku yang telah dibahas selama pengembangan.
- Selalu cocokkan route, validation schema, controller, service, dan repository pada branch aktif sebelum menggunakan dokumen sebagai kontrak integrasi frontend.
- Tandai endpoint sebagai tested hanya setelah request dan response aktual diverifikasi melalui Bruno atau automated test.
- Jangan menganggap typecheck/build sebagai pengganti integration, security, concurrency, dan end-to-end testing.

