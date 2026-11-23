# SESAJI API — Device Tokens Module

> Dokumentasi ini dibuat berdasarkan source `src/modules/device-tokens/*` yang diberikan. Prefix mount router pada entry point aplikasi tidak disertakan; endpoint ditulis menggunakan prefix `/device-tokens` sesuai komentar pada route.

## 1. Ringkasan

Device Tokens Module mengelola Firebase Cloud Messaging (FCM) device token milik user agar server dapat mengirim push notification ke perangkat yang terdaftar.

Fitur yang tersedia:

- Mendaftarkan atau memperbarui device token.
- Mencabut (revoke) device token milik user.
- Mengambil token aktif user untuk pengiriman push notification internal.
- Mencabut token yang dilaporkan invalid oleh Firebase.

Endpoint HTTP pada modul ini hanya menyediakan registrasi dan revoke token. Pengiriman push dilakukan melalui service internal, bukan endpoint publik di router ini.

## 2. Authentication dan akses

Router menjalankan `router.use(authenticate)`, sehingga seluruh endpoint membutuhkan autentikasi.

`userId` selalu diambil dari `req.auth.userId`. Saat revoke, repository mencocokkan `userId`, token, dan status aktif. User tidak dapat mencabut token milik user lain melalui endpoint ini.

Tidak ada pembatasan role khusus pada router.

## 3. Daftar endpoint

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/device-tokens` | Mendaftarkan atau memperbarui device token |
| DELETE | `/device-tokens` | Mencabut device token aktif |

## 4. Detail endpoint

### 4.1 POST `/device-tokens`

Mendaftarkan device token untuk user yang sedang login. Operasi menggunakan upsert berdasarkan nilai `token`.

**Request body**

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `token` | string | Ya | Di-trim, minimal 1 karakter, maksimal 512 karakter |
| `platform` | string | Ya | `ANDROID` atau `WEB` |
| `deviceId` | string atau `null` | Tidak | Di-trim, maksimal 255 karakter |

Object body bersifat strict; field tambahan di luar schema ditolak oleh Zod.

**Contoh request**

```http
POST /device-tokens
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "token": "fcm-device-token-from-client",
  "platform": "ANDROID",
  "deviceId": "android-device-identifier"
}
```

`deviceId` boleh tidak dikirim atau dikirim sebagai `null`.

**Response sukses — HTTP 201**

```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "id": "device-token-uuid",
    "userId": "user-uuid",
    "token": "fcm-device-token-from-client",
    "platform": "ANDROID",
    "deviceId": "android-device-identifier",
    "lastUsedAt": "2026-11-23T10:00:00.000Z",
    "revokedAt": null,
    "updatedAt": "2026-11-23T10:00:00.000Z"
  }
}
```

Contoh `data` menggambarkan row hasil `returning()` dan bukan jaminan daftar kolom lengkap; bentuk aktual mengikuti schema tabel `deviceTokens`.

**Perilaku upsert**

Saat token belum ada, record baru dibuat dengan:
- `userId` user yang sedang login.
- `token` dan `platform` dari request.
- `deviceId` dari request, atau `null` jika tidak dikirim.
- `lastUsedAt` diisi waktu saat ini.
- `revokedAt` diatur menjadi `null`.
- `updatedAt` diisi waktu saat ini.

Jika token sudah ada (konflik pada kolom `deviceTokens.token`), record yang ada diperbarui:
- `userId` diganti menjadi user yang sedang login.
- `platform` dan `deviceId` diperbarui.
- `lastUsedAt` dan `updatedAt` diisi waktu saat ini.
- `revokedAt` diatur kembali menjadi `null`.

**Catatan penting:** token menjadi kunci konflik upsert. Karena `userId` ikut diperbarui, registrasi token yang sama oleh user lain akan memindahkan kepemilikan record token tersebut ke user yang melakukan registrasi terakhir.

Jika proses repository gagal, service melempar `AppError` HTTP 500 dengan pesan `Failed to register device token`.

### 4.2 DELETE `/device-tokens`

Mencabut device token aktif milik user yang sedang login.

**Request body**

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `token` | string | Ya | Di-trim, minimal 1 karakter, maksimal 512 karakter |

Body bersifat strict.

**Contoh request**

```http
DELETE /device-tokens
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "token": "fcm-device-token-from-client"
}
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Device token revoked successfully",
  "data": {
    "revoked": true
  }
}
```

**Perilaku revoke**

Repository hanya memperbarui record jika ketiga kondisi terpenuhi:
- `userId` cocok dengan user yang sedang login.
- `token` cocok dengan token pada request.
- `revokedAt IS NULL` (token masih aktif).

Jika tidak ada record aktif yang cocok, service melempar HTTP 404 dengan pesan `Active device token not found`.

Revoke bersifat soft revoke: record tidak dihapus, tetapi `revokedAt` diisi waktu saat ini dan `updatedAt` diperbarui.

## 5. Validasi dan error

Validasi request menggunakan `validate(...)` dengan schema Zod.

| Kondisi | Hasil yang didefinisikan source |
|---|---|
| `token` kosong setelah trim | Gagal validasi |
| `token` lebih dari 512 karakter | Gagal validasi |
| `platform` bukan `ANDROID` atau `WEB` | Gagal validasi |
| `deviceId` lebih dari 255 karakter | Gagal validasi |
| Mengirim field tambahan | Gagal karena schema `.strict()` |
| Token aktif tidak ditemukan saat revoke | HTTP 404, `Active device token not found` |
| Repository gagal saat register | HTTP 500, `Failed to register device token` |

Format response kegagalan dari middleware `validate`, autentikasi, dan error handler global tidak terlihat pada source modul ini, sehingga tidak diasumsikan di sini.

## 6. Alur pengiriman push notification internal

Service menyediakan `sendPushToUser(input)` untuk digunakan oleh modul lain.

**Input**

```ts
interface SendUserPushInput {
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}
```

**Alur**

1. Service mengambil device token aktif berdasarkan `userId`.
2. Token aktif didefinisikan sebagai record dengan `revokedAt IS NULL`.
3. Jika tidak ada token aktif, service langsung mengembalikan:
   ```json
   {
     "successCount": 0,
     "failureCount": 0
   }
   ```
4. Jika ada token aktif, service memanggil `sendPushNotification` dari integrasi Firebase Messaging dengan daftar token, `title`, `body`, dan `data`.
5. Jika Firebase melaporkan `invalidTokens`, service mencari ID record token terkait dan melakukan revoke massal.
6. Service mengembalikan jumlah push yang berhasil dan gagal menurut hasil Firebase.

**Contoh hasil service**

```json
{
  "successCount": 2,
  "failureCount": 1
}
```

Nilai tersebut hanya ilustrasi; jumlah aktual berasal dari hasil `sendPushNotification`.

### Revoke token invalid

`revokeDeviceTokensByIds(tokenIds)`:
- Mengembalikan `0` jika array ID kosong.
- Memperbarui `revokedAt` dan `updatedAt` untuk token dengan ID yang diberikan dan masih aktif.
- Mengembalikan jumlah row yang berhasil diperbarui.

Dengan mekanisme ini, token yang dianggap invalid oleh Firebase tidak terus digunakan dalam pengiriman push berikutnya.

## 7. Repository helper lainnya

Repository juga menyediakan `updateDeviceTokenLastUsed(tokenId)`, yang memperbarui `lastUsedAt` dan `updatedAt` untuk record berdasarkan ID.

Namun, fungsi tersebut tidak dipanggil oleh service yang disertakan pada source ini. Karena itu, dokumentasi tidak mengasumsikan kapan fungsi tersebut dijalankan.

## 8. Contoh pengujian di Bruno

Gunakan environment variable `baseUrl` dan `token`.

**Register device**

```http
POST {{baseUrl}}/device-tokens
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "token": "fcm-device-token-from-client",
  "platform": "WEB",
  "deviceId": "browser-device-identifier"
}
```

**Revoke device**

```http
DELETE {{baseUrl}}/device-tokens
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "token": "fcm-device-token-from-client"
}
```

## 9. Catatan implementasi dan batas dokumentasi

- Controller menetapkan HTTP 201 untuk registrasi dan HTTP 200 untuk revoke.
- Prefix `/device-tokens` mengikuti komentar route module; mount path aktual pada entry point belum disertakan.
- Semua endpoint memerlukan autentikasi.
- Platform yang didukung oleh schema adalah `ANDROID` dan `WEB`; platform lain tidak diterima oleh validasi.
- Token disimpan dengan upsert berdasarkan kolom `token`, bukan kombinasi `userId` dan `token`.
- Revoke tidak menghapus row dari database, melainkan mengisi `revokedAt`.
- Pengiriman push dilakukan melalui integrasi Firebase Messaging dan service internal.
- Source schema database, middleware `validate`, middleware `authenticate`, error handler global, serta implementasi `firebase-messaging` tidak disertakan. Detail internal yang tidak tampak pada source tersebut tidak diasumsikan.
