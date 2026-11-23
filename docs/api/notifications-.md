# SESAJI API — Notifications Module

> Dokumentasi ini disusun berdasarkan source `src/modules/notifications/*` yang diberikan. Prefix mount router pada entry point aplikasi tidak disertakan, sehingga endpoint ditulis menggunakan prefix `/notifications` sesuai komentar dan route module.

## 1. Ringkasan

Notifications Module mengelola notifikasi milik user yang sedang login. Modul menyediakan fitur:

- Melihat daftar notifikasi dengan pagination.
- Memfilter notifikasi yang belum dibaca.
- Melihat jumlah notifikasi belum dibaca.
- Menandai satu notifikasi sebagai sudah dibaca.
- Menandai seluruh notifikasi sebagai sudah dibaca.
- Menghapus notifikasi milik sendiri.

Pembuatan notifikasi dilakukan secara internal oleh modul lain melalui service, bukan melalui endpoint publik pada router ini.

## 2. Authentication dan akses

Semua endpoint menggunakan middleware `authenticate` melalui `router.use(authenticate)`.

Identitas pemilik notifikasi diambil dari `req.auth.userId`. Repository selalu membatasi operasi berdasarkan `notifications.userId`, sehingga user hanya dapat membaca, mengubah status baca, atau menghapus notifikasinya sendiri.

Tidak ada role khusus yang didefinisikan pada router Notifications.

## 3. Daftar endpoint

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/notifications` | Mengambil daftar notifikasi user |
| GET | `/notifications/unread-count` | Mengambil jumlah notifikasi belum dibaca |
| PATCH | `/notifications/read-all` | Menandai semua notifikasi sebagai sudah dibaca |
| PATCH | `/notifications/:id/read` | Menandai satu notifikasi sebagai sudah dibaca |
| DELETE | `/notifications/:id` | Menghapus satu notifikasi |

Semua endpoint membutuhkan autentikasi Bearer/JWT sesuai middleware autentikasi aplikasi.

## 4. Detail endpoint

### 4.1 GET `/notifications`

Mengambil notifikasi milik user yang sedang login.

**Query parameters**

| Parameter | Tipe | Default | Aturan |
|---|---|---:|---|
| `page` | number | `1` | Integer, minimal 1 |
| `limit` | number | `20` | Integer, minimal 1, maksimal 50 |
| `unreadOnly` | string | — | Hanya menerima `"true"` atau `"false"` |

Query divalidasi menggunakan Zod. `page` dan `limit` dikonversi menjadi number. `unreadOnly` dikonversi menjadi boolean. Object query bersifat strict, sehingga parameter lain yang tidak didefinisikan tidak diterima.

**Contoh request**

```http
GET /notifications?page=1&limit=20&unreadOnly=true
Authorization: Bearer <access_token>
```

**Contoh response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": {
    "items": [
      {
        "id": "notification-uuid",
        "userId": "user-uuid",
        "type": "NEW_FOOD_REQUEST",
        "title": "Permintaan makanan baru",
        "body": "Ada permintaan baru untuk listing makanan Anda.",
        "data": {
          "foodListingId": "listing-uuid"
        },
        "readAt": null,
        "createdAt": "2026-11-23T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

Contoh item di atas merupakan ilustrasi struktur data; field aktual mengikuti schema tabel `notifications` dan nilai yang tersimpan.

**Perilaku query**

- Hasil hanya untuk user yang sedang login.
- Jika `unreadOnly=true`, hanya notifikasi dengan `readAt IS NULL` yang diambil.
- Urutan berdasarkan `createdAt` descending (terbaru lebih dahulu).
- Pagination menggunakan offset `(page - 1) * limit`.
- `totalPages` dihitung dengan `Math.ceil(total / limit)`.

### 4.2 GET `/notifications/unread-count`

Mengambil jumlah notifikasi yang belum dibaca oleh user yang sedang login.

**Contoh request**

```http
GET /notifications/unread-count
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Unread notification count retrieved successfully",
  "data": {
    "total": 3
  }
}
```

Perhitungan hanya menghitung notifikasi milik user tersebut dengan `readAt IS NULL`.

### 4.3 PATCH `/notifications/read-all`

Menandai seluruh notifikasi yang belum dibaca milik user yang sedang login sebagai sudah dibaca.

**Contoh request**

```http
PATCH /notifications/read-all
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updated": 3
  }
}
```

`updated` adalah jumlah baris notifikasi yang berhasil diperbarui. Notifikasi yang sudah dibaca tidak diperbarui lagi.

### 4.4 PATCH `/notifications/:id/read`

Menandai satu notifikasi sebagai sudah dibaca.

**Path parameter**

| Parameter | Tipe | Aturan |
|---|---|---|
| `id` | string | UUID valid |

**Contoh request**

```http
PATCH /notifications/550e8400-e29b-41d4-a716-446655440000/read
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "readAt": "2026-11-23T10:00:00.000Z"
  }
}
```

Response `data` mengembalikan row notifikasi hasil update; contoh di atas hanya menampilkan sebagian field.

**Perilaku dan error**

- Update hanya dilakukan jika ID cocok, `userId` adalah user yang sedang login, dan `readAt IS NULL`.
- Jika notifikasi tidak ditemukan, bukan milik user, atau sudah dibaca, service melempar `AppError` HTTP 404 dengan pesan `Notification not found or already read`.

### 4.5 DELETE `/notifications/:id`

Menghapus notifikasi milik user yang sedang login.

**Path parameter**

| Parameter | Tipe | Aturan |
|---|---|---|
| `id` | string | UUID valid |

**Contoh request**

```http
DELETE /notifications/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Notification deleted successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Perilaku dan error**

- Delete dibatasi berdasarkan ID notifikasi dan `userId` user yang sedang login.
- Jika tidak ada row yang cocok, service melempar `AppError` HTTP 404 dengan pesan `Notification not found`.

## 5. Validasi dan error

### Validasi ID

Route `PATCH /:id/read` dan `DELETE /:id` menjalankan `notificationParamsSchema`:

- `id` wajib berupa UUID valid.
- Jika tidak valid, route mengembalikan HTTP 422.

**Response validasi ID gagal**

```json
{
  "success": false,
  "message": "Invalid notification ID",
  "errors": [
    {
      "field": "id",
      "message": "Invalid UUID"
    }
  ]
}
```

Pesan detail `issue.message` berasal dari Zod.

### Validasi query

`GET /notifications` menggunakan `validateQuery(notificationQuerySchema)`:

- `page`: integer minimal 1, default 1.
- `limit`: integer 1–50, default 20.
- `unreadOnly`: `"true"` atau `"false"`.
- Query object strict.

Bentuk response error dari middleware `validateQuery` tidak terlihat pada source yang diberikan, sehingga tidak didokumentasikan sebagai format pasti.

### Error service

| Kondisi | HTTP status | Pesan |
|---|---:|---|
| Notifikasi tidak ditemukan / bukan milik user / sudah dibaca saat mark-as-read | 404 | `Notification not found or already read` |
| Notifikasi tidak ditemukan saat delete | 404 | `Notification not found` |
| ID bukan UUID valid | 422 | `Invalid notification ID` |

Error autentikasi dan format error global mengikuti middleware aplikasi; source middleware tersebut tidak termasuk dalam file modul ini.

## 6. Jenis notifikasi

`NOTIFICATION_TYPES` mendefinisikan jenis berikut:

| Type | Makna berdasarkan nama |
|---|---|
| `NEW_FOOD_REQUEST` | Permintaan makanan baru |
| `REQUEST_APPROVED` | Permintaan disetujui |
| `REQUEST_REJECTED` | Permintaan ditolak |
| `REQUEST_EXPIRED` | Permintaan kedaluwarsa |
| `NEW_DELIVERY_TASK` | Tugas pengantaran baru |
| `DELIVERY_STATUS_UPDATED` | Status pengantaran diperbarui |
| `DONATION_COMPLETED` | Donasi selesai |
| `LISTING_EXPIRING` | Listing mendekati kedaluwarsa |
| `LISTING_EXPIRED` | Listing kedaluwarsa |
| `SYSTEM` | Notifikasi sistem |
| `VERIFICATION_APPROVED` | Verifikasi disetujui |
| `VERIFICATION_REJECTED` | Verifikasi ditolak |

Daftar di atas adalah konstanta tipe yang tersedia pada source. Pemicu bisnis spesifik setiap jenis notifikasi tidak didefinisikan di dalam folder Notifications ini.

## 7. Pembuatan notifikasi internal

Service menyediakan dua fungsi untuk pembuatan notifikasi:

### `createNotification(input)`

Meneruskan input ke repository untuk menyimpan notifikasi ke database. Fungsi ini tidak mengirim push notification.

Input:

```ts
interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
```

### `createNotificationSafely(input)`

Alur yang terlihat pada source:

1. Menyimpan notifikasi ke database.
2. Jika hasil insert tidak tersedia, mencatat error dan mengembalikan `null`.
3. Setelah insert berhasil, mengirim push melalui `sendPushToUser`.
4. Payload push menyertakan `notificationId`, `type`, dan nilai `data` yang dikonversi menjadi string.
5. Jika pengiriman push gagal, error dicatat tetapi notifikasi database tetap dikembalikan.
6. Jika proses insert melempar error, error dicatat dan fungsi mengembalikan `null`.

Dengan demikian, kegagalan push tidak membatalkan notifikasi yang sudah berhasil disimpan.

## 8. Contoh pengujian di Bruno

Gunakan environment variable `baseUrl` dan `token`.

**Get notifications**

```http
GET {{baseUrl}}/notifications?page=1&limit=20
Authorization: Bearer {{token}}
```

**Get unread count**

```http
GET {{baseUrl}}/notifications/unread-count
Authorization: Bearer {{token}}
```

**Get unread only**

```http
GET {{baseUrl}}/notifications?page=1&limit=20&unreadOnly=true
Authorization: Bearer {{token}}
```

**Mark one as read**

```http
PATCH {{baseUrl}}/notifications/{{notificationId}}/read
Authorization: Bearer {{token}}
```

**Mark all as read**

```http
PATCH {{baseUrl}}/notifications/read-all
Authorization: Bearer {{token}}
```

**Delete notification**

```http
DELETE {{baseUrl}}/notifications/{{notificationId}}
Authorization: Bearer {{token}}
```

## 9. Catatan implementasi dan batas dokumentasi

- Controller pada source menetapkan HTTP 200 untuk seluruh operasi yang berhasil.
- Prefix `/notifications` mengikuti komentar route module. Mount path aktual pada entry point belum disertakan.
- Semua endpoint dilindungi `authenticate`.
- Operasi baca, update, dan delete selalu dibatasi ke `userId` yang sedang login.
- Pembuatan notifikasi tidak memiliki endpoint HTTP pada router ini; prosesnya dipanggil secara internal.
- Source schema database tidak disertakan. Karena itu, contoh row notifikasi bukan representasi lengkap/otoritatif seluruh kolom tabel.
- Source middleware autentikasi, `validateQuery`, error handler global, dan device-token service tidak disertakan. Detail implementasi internalnya tidak diasumsikan di dokumentasi ini.
