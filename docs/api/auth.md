# SESAJI API — Auth Module

> Dokumentasi ini disusun dari source `auth.routes.ts`, `auth.service.ts`, `auth.repository.ts`, `auth.types.ts`, dan `auth.validation.ts` yang dikirim pada 23 November 2026.
>
> **Batas verifikasi:** `auth.controller.ts`, konfigurasi rate limiter, konfigurasi cookie, error middleware, dan mounting router tidak disertakan. Karena itu, bentuk JSON di bawah yang berasal dari service dapat dipastikan, tetapi pembungkus HTTP response, status sukses, dan atribut cookie belum boleh dianggap kontrak final.

## 1. Informasi Modul

| Properti | Nilai |
|---|---|
| Modul | Authentication |
| Route prefix | `/auth` (prefix global perlu dicocokkan dengan mounting router) |
| Base URL dokumentasi proyek | `http://localhost:3000/api/v1` |
| Content-Type | `application/json` untuk request JSON |
| Authentication | Bergantung endpoint |
| Password hashing | Argon2id |
| Access token | JWT HS256 |
| Refresh token | Opaque token, disimpan dalam bentuk SHA-256 hash |
| Email verification token | 32 random bytes dalam hex (64 karakter), disimpan dalam bentuk SHA-256 hash |
| Email verification TTL | 15 menit |

Semua URL contoh di dokumen ini menggunakan asumsi prefix global `/api/v1`.

## 2. Route Summary

| Method | Endpoint | Middleware | Akses |
|---|---|---|---|
| POST | `/auth/register` | `registerLimiter`, `validate(registerSchema)` | Public |
| POST | `/auth/login` | `loginLimiter`, `validate(loginSchema)` | Public |
| POST | `/auth/verify-email` | `verificationLimiter`, `validate(verifyEmailSchema)` | Public |
| POST | `/auth/resend-verification` | `resendVerificationLimiter`, `validate(resendVerificationSchema)` | Public |
| POST | `/auth/refresh` | `refreshLimiter`, `csrfProtection` | Refresh cookie + CSRF |
| POST | `/auth/logout` | `authenticate` | Bearer access token |
| GET | `/auth/me` | `authenticate` | Bearer access token |

Urutan middleware di atas mengikuti deklarasi route. Konfigurasi jumlah request dan jendela rate limit belum tersedia pada source yang dikirim.

---

## 3. Register

Mendaftarkan user baru, membuat profil berdasarkan role, membuat email verification token, lalu mengirim email verifikasi.

- **Method:** `POST`
- **URL:** `/api/v1/auth/register`
- **Authentication:** Tidak diperlukan
- **Headers:**

```http
Content-Type: application/json
Accept: application/json
```

### 3.1 Request — Donor Individual

```json
{
  "fullName": "Budi Santoso",
  "email": "budi@example.com",
  "phoneNumber": "081234567890",
  "password": "StrongPassword123",
  "role": "DONOR_INDIVIDUAL",
  "profile": {
    "type": "DONOR_INDIVIDUAL"
  }
}
```

### 3.2 Request — Donor Business

```json
{
  "fullName": "Budi Santoso",
  "email": "budi@example.com",
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

### 3.3 Request — Receiver

```json
{
  "fullName": "Siti Aminah",
  "email": "siti@example.com",
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

### 3.4 Request — Volunteer

```json
{
  "fullName": "Andi Saputra",
  "email": "andi@example.com",
  "password": "StrongPassword123",
  "role": "VOLUNTEER",
  "profile": {
    "type": "VOLUNTEER",
    "vehicleType": "MOTORCYCLE"
  }
}
```

### 3.5 Validasi Request

Validasi mengikuti `registerSchema`:

| Field | Tipe | Aturan |
|---|---|---|
| `fullName` | string | Trim, minimal 3, maksimal 255 karakter |
| `email` | string | Trim, format email valid, maksimal 255 karakter |
| `phoneNumber` | string | Opsional, trim, 8–30 karakter |
| `password` | string | 12–128 karakter, wajib mengandung huruf kecil, huruf besar, dan angka |
| `role` | enum | Salah satu dari empat role yang didukung |
| `profile` | object | Bentuk harus sesuai role |

Detail profil:

| Role | Field | Aturan |
|---|---|---|
| `DONOR_INDIVIDUAL` | `type` | Literal `DONOR_INDIVIDUAL` |
| `DONOR_BUSINESS` | `type` | Literal `DONOR_BUSINESS` |
| `DONOR_BUSINESS` | `businessName` | Trim, 2–255 karakter |
| `DONOR_BUSINESS` | `businessType` | Trim, 2–100 karakter |
| `RECEIVER` | `type` | Literal `RECEIVER` |
| `RECEIVER` | `institutionName` | Trim, 2–255 karakter |
| `RECEIVER` | `institutionType` | Trim, 2–100 karakter |
| `RECEIVER` | `description` | Opsional, maksimal 2.000 karakter |
| `RECEIVER` | `capacityPortions` | Opsional, integer positif |
| `VOLUNTEER` | `type` | Literal `VOLUNTEER` |
| `VOLUNTEER` | `vehicleType` | Opsional, trim, maksimal 100 karakter |

`profile.type` harus sama dengan `role` karena schema menggunakan discriminated union.

### 3.6 Service Result — Success

Service `register()` mengembalikan object berikut:

```json
{
  "userId": "UUID",
  "email": "budi@example.com",
  "message": "Registration successful. Please verify your email."
}
```

**Catatan:** Ini adalah return value service. HTTP status dan apakah controller membungkus object ini ke dalam `data` belum dapat diverifikasi tanpa `auth.controller.ts`.

### 3.7 Error yang Dilempar Service

| HTTP status dari `AppError` | Message | Kondisi |
|---|---|---|
| 400 | `Invalid registration role` | Role tidak didukung |
| 400 | `Invalid donor profile` | Tipe profil donor individu tidak cocok |
| 400 | `Invalid business profile` | Tipe profil donor bisnis tidak cocok |
| 400 | `Invalid receiver profile` | Tipe profil receiver tidak cocok |
| 400 | `Invalid volunteer profile` | Tipe profil volunteer tidak cocok |
| 409 | `Email is already registered` | Email ditemukan sebelum proses insert |
| 409 | `Email or phone number is already registered` | Konflik unique constraint database |
| 500 | `Registration role is not configured` | Role tidak ditemukan di database |
| 500 | `Failed to create authentication session` | Khusus pembuatan session; bukan alur register normal |
| 503 | `Account created, but verification email could not be sent. Please request a new verification email.` | Akun dan token telah dibuat, tetapi email gagal dikirim |

### 3.8 Business Logic

1. Email dan nama di-trim; email diubah menjadi lowercase.
2. Service memeriksa apakah email sudah terdaftar.
3. Role diperiksa terhadap allowlist.
4. Role dan `profile.type` harus cocok.
5. Password di-hash menggunakan Argon2id.
6. User dan profil dibuat dalam satu transaksi repository.
7. Token verifikasi dibuat dari 32 random bytes dan diubah menjadi hex.
8. Database menyimpan SHA-256 hash token, bukan token mentah.
9. Token berlaku selama 15 menit.
10. Email verifikasi dikirim setelah user dan token tersimpan.

Jika pengiriman email gagal, service melempar `503`, tetapi akun sudah terlanjur dibuat. User dapat meminta pengiriman ulang melalui endpoint resend verification.

---

## 4. Login

Memverifikasi kredensial user dan membuat session autentikasi.

- **Method:** `POST`
- **URL:** `/api/v1/auth/login`
- **Authentication:** Tidak diperlukan

### 4.1 Request

```json
{
  "email": "budi@example.com",
  "password": "StrongPassword123"
}
```

### 4.2 Validasi Request

| Field | Tipe | Aturan |
|---|---|---|
| `email` | string | Trim, email valid, maksimal 255 karakter |
| `password` | string | 1–128 karakter |

### 4.3 Service Result — Success

Return value `login()` memiliki bentuk berikut:

```json
{
  "user": {
    "id": "UUID",
    "fullName": "Budi Santoso",
    "email": "budi@example.com",
    "phoneNumber": "081234567890",
    "role": "DONOR_INDIVIDUAL",
    "accountStatus": "ACTIVE",
    "emailVerifiedAt": "2026-11-23T10:00:00.000Z"
  },
  "accessToken": "JWT_ACCESS_TOKEN",
  "refreshToken": "OPAQUE_REFRESH_TOKEN",
  "expiresAt": "2026-11-30T10:00:00.000Z"
}
```

Nilai di atas adalah contoh representasi. `expiresAt` dari `issueSession()` merupakan waktu kedaluwarsa refresh session berdasarkan `JWT_REFRESH_EXPIRES_IN`, bukan klaim waktu kedaluwarsa access token.

**Penting:** Service mengembalikan `refreshToken`, tetapi route/controller dapat memindahkannya ke HttpOnly cookie. Bentuk HTTP response aktual dan konfigurasi cookie belum dapat dipastikan tanpa controller.

### 4.4 Error yang Dilempar Service

| HTTP status | Message | Kondisi |
|---|---|---|
| 401 | `Invalid email or password` | Email tidak ditemukan atau password salah |
| 403 | `Please verify your email first` | Email belum diverifikasi |
| 403 | `Your account has been suspended` | Akun berstatus `SUSPENDED` |
| 500 | `Failed to create authentication session` | Gagal membuat session |

### 4.5 Business Logic

1. Email di-trim dan diubah menjadi lowercase.
2. User dicari berdasarkan email.
3. Password diverifikasi menggunakan Argon2.
4. Email harus sudah diverifikasi.
5. Akun tidak boleh berstatus `SUSPENDED`.
6. Session baru dibuat dengan refresh token hash, metadata user-agent/IP (jika tersedia), dan expiry.
7. Access token JWT dibuat dengan claim `role`, `sid`, dan subject berupa user ID.

---

## 5. Verify Email

Memvalidasi token email dan menandai email user sebagai terverifikasi.

- **Method:** `POST`
- **URL:** `/api/v1/auth/verify-email`
- **Authentication:** Tidak diperlukan

### 5.1 Request

```json
{
  "token": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
}
```

### 5.2 Validasi Request

| Field | Tipe | Aturan |
|---|---|---|
| `token` | string | Tepat 64 karakter dan hanya hexadecimal |

### 5.3 Service Result — Success

```json
{
  "message": "Email verified successfully"
}
```

### 5.4 Error yang Dilempar Service

| HTTP status | Message | Kondisi |
|---|---|---|
| 400 | `Verification token is invalid or expired` | Hash token tidak ditemukan, token sudah digunakan, atau kedaluwarsa |
| 400 | `Verification token is invalid or already used` | Token gagal dikonsumsi saat transaksi |

### 5.5 Business Logic

1. Token mentah di-hash menggunakan SHA-256.
2. Repository mencari token yang belum digunakan dan belum kedaluwarsa.
3. Token dikonsumsi dalam transaksi dengan pemeriksaan ulang status dan expiry.
4. Email user diisi dengan waktu verifikasi.
5. Jika role user adalah `DONOR_INDIVIDUAL` atau `VOLUNTEER`, `accountStatus` diubah menjadi `ACTIVE`.
6. Untuk `DONOR_BUSINESS` dan `RECEIVER`, proses ini tidak otomatis mengubah `accountStatus` menjadi `ACTIVE`.

---

## 6. Resend Email Verification

Menerbitkan token verifikasi baru dan mengirim ulang email verifikasi jika akun memenuhi syarat.

- **Method:** `POST`
- **URL:** `/api/v1/auth/resend-verification`
- **Authentication:** Tidak diperlukan

### 6.1 Request

```json
{
  "email": "budi@example.com"
}
```

### 6.2 Validasi Request

| Field | Tipe | Aturan |
|---|---|---|
| `email` | string | Trim, email valid, maksimal 255 karakter |

### 6.3 Service Result — Success

```json
{
  "message": "If the account requires verification, a verification email will be sent."
}
```

Response service dibuat generik untuk mencegah kebocoran informasi apakah suatu email terdaftar.

### 6.4 Error yang Dilempar Service

| HTTP status | Message | Kondisi |
|---|---|---|
| 500 | `Could not create verification token` | Gagal membuat token baru |
| 503 | `Unable to send verification email. Please try again later.` | Pengiriman email gagal |

### 6.5 Business Logic

Service tidak mengirim email jika:

- Email tidak ditemukan.
- Email sudah terverifikasi.
- Akun berstatus `SUSPENDED`.

Jika akun memenuhi syarat:

1. Token baru dibuat.
2. Token verifikasi lama yang belum digunakan ditandai telah digunakan.
3. Token baru disimpan dalam transaksi yang sama.
4. Email verifikasi dikirim.
5. Response tetap generik.

---

## 7. Refresh Access Token

Memperbarui access token dengan refresh token yang tersimpan di cookie.

- **Method:** `POST`
- **URL:** `/api/v1/auth/refresh`
- **Authentication:** Refresh cookie, bukan Bearer access token
- **Middleware:** `refreshLimiter`, `csrfProtection`

### 7.1 Headers

```http
Content-Type: application/json
Accept: application/json
Cookie: sesaji_refresh_token=OPAQUE_REFRESH_TOKEN
Origin: https://frontend.example.com
X-CSRF-Protection: 1
```

Nama cookie dan header CSRF harus dicocokkan kembali dengan implementasi middleware/controller. Route yang dikirim memasang `csrfProtection`.

### 7.2 Request Body

Route refresh tidak memasang `validate(refreshSchema)`. Schema `refreshSchema` memang didefinisikan sebagai object kosong yang strict, tetapi penggunaannya pada route ini tidak terlihat.

Jika controller membaca body, kontrak body perlu diperiksa dari controller. Jangan menganggap `{}` sebagai persyaratan yang sudah dibuktikan oleh route.

### 7.3 Service Result — Success

Service `refresh()` mengembalikan:

```json
{
  "accessToken": "NEW_JWT_ACCESS_TOKEN",
  "refreshToken": "NEW_OPAQUE_REFRESH_TOKEN",
  "expiresAt": "2026-11-30T10:00:00.000Z"
}
```

`expiresAt` adalah expiry refresh session yang baru.

### 7.4 Error yang Dilempar Service

| HTTP status | Message | Kondisi |
|---|---|---|
| 401 | `Invalid or expired refresh token` | Refresh token tidak ditemukan, expired, atau session tidak aktif |
| 401 | `Refresh token reuse detected. Please login again.` | Token sebelumnya digunakan kembali setelah rotasi |
| 401 | `Session is no longer valid` | User tidak ditemukan, suspended, atau email belum terverifikasi |
| 401 | `Refresh token is invalid or expired` | Rotasi gagal atau token tidak lagi valid |

Middleware CSRF dapat menolak request sebelum service dipanggil. Bentuk response error CSRF belum diketahui dari source yang tersedia.

### 7.5 Business Logic dan Token Rotation

1. Refresh token dari cookie di-hash dengan SHA-256.
2. Repository mencari session yang aktif dan belum kedaluwarsa.
3. Token yang cocok dengan `previousRefreshTokenHash` dianggap reuse.
4. Jika reuse terdeteksi, session dicabut dan user harus login kembali.
5. User harus masih ada, email terverifikasi, dan tidak suspended.
6. Refresh token baru dibuat.
7. Token lama dipindahkan ke `previousRefreshTokenHash`.
8. Hash refresh token baru disimpan dan expiry diperbarui.
9. Access token baru diterbitkan.

---

## 8. Logout

Mencabut session milik user yang sedang login.

- **Method:** `POST`
- **URL:** `/api/v1/auth/logout`
- **Authentication:** Bearer access token

### 8.1 Headers

```http
Authorization: Bearer ACCESS_TOKEN
Accept: application/json
```

### 8.2 Request Body

Tidak ada request body yang diwajibkan oleh route.

### 8.3 Service Result — Success

```json
{
  "message": "Logged out successfully"
}
```

### 8.4 Error yang Dilempar Service

| HTTP status | Message | Kondisi |
|---|---|---|
| 404 | `Session not found` | Session tidak ditemukan, bukan milik user, atau sudah dicabut |

### 8.5 Business Logic

1. Middleware `authenticate` memvalidasi access token.
2. Service menerima `sessionId` dan `userId` dari konteks autentikasi.
3. Repository mencabut session jika ID session dan user cocok serta session belum dicabut.
4. Jika session tidak ditemukan, service melempar `404`.

Efek penghapusan refresh cookie pada response HTTP perlu diverifikasi melalui controller.

---

## 9. Get Current User

Mengambil informasi user berdasarkan identitas pada access token.

- **Method:** `GET`
- **URL:** `/api/v1/auth/me`
- **Authentication:** Bearer access token

### 9.1 Headers

```http
Authorization: Bearer ACCESS_TOKEN
Accept: application/json
```

### 9.2 Request Body

Tidak ada.

### 9.3 Service Result — Success

```json
{
  "id": "USER_UUID",
  "fullName": "Budi Santoso",
  "email": "budi@example.com",
  "phoneNumber": "081234567890",
  "role": "DONOR_INDIVIDUAL",
  "accountStatus": "ACTIVE",
  "emailVerifiedAt": "2026-11-23T10:00:00.000Z",
  "phoneVerifiedAt": null,
  "createdAt": "2026-11-20T08:00:00.000Z"
}
```

### 9.4 Error yang Dilempar Service

| HTTP status | Message | Kondisi |
|---|---|---|
| 404 | `User not found` | User dari token tidak ditemukan |

---

## 10. Authentication & Session Design

### 10.1 Access Token

Access token dibuat menggunakan `jose` `SignJWT`:

- Algorithm: `HS256`
- Subject (`sub`): user ID
- Claim `role`: role user
- Claim `sid`: session ID
- `iat`: waktu penerbitan
- `exp`: mengikuti `JWT_ACCESS_EXPIRES_IN`
- Secret: `JWT_ACCESS_SECRET`

Contoh payload konseptual (bukan token aktual):

```json
{
  "role": "DONOR_INDIVIDUAL",
  "sid": "SESSION_UUID",
  "sub": "USER_UUID",
  "iat": 1795428000,
  "exp": 1795428900
}
```

Nilai expiry aktual bergantung environment.

### 10.2 Refresh Token

- Dibuat dari `randomBytes(32).toString("hex")`.
- Token mentah dikirim ke client melalui mekanisme controller.
- Database menyimpan SHA-256 hash token.
- Session menyimpan expiry, user-agent, IP address, last-used timestamp, dan revoked timestamp.
- Rotasi menyimpan hash token sebelumnya untuk mendeteksi reuse.

### 10.3 Email Verification Token

- Dibuat dari 32 random bytes dalam representasi hexadecimal.
- Panjang token mentah: 64 karakter.
- Database menyimpan SHA-256 hash.
- TTL: 15 menit.
- Token hanya dapat digunakan sekali.
- Resend menandai token lama yang belum digunakan sebagai sudah digunakan.

---

## 11. Role dan Account Activation

Role yang dapat melakukan registrasi:

| Role | Profil | Aktivasi otomatis setelah verifikasi email |
|---|---|---|
| `DONOR_INDIVIDUAL` | `DONOR_INDIVIDUAL` | Ya |
| `DONOR_BUSINESS` | `DONOR_BUSINESS` | Tidak |
| `RECEIVER` | `RECEIVER` | Tidak |
| `VOLUNTEER` | `VOLUNTEER` | Ya |

Catatan: Status akhir donor bisnis dan receiver memerlukan alur aktivasi/verifikasi lain. Detail alur tersebut berada di luar Auth module yang dikirim.

---

## 12. Error Response — Batas Kepastian

Service melempar `AppError(statusCode, message)`. Namun bentuk JSON HTTP final dibentuk oleh error middleware/controller yang tidak disertakan.

Bentuk berikut **hanya contoh ilustratif**, bukan response yang sudah diverifikasi:

```json
{
  "success": false,
  "message": "Invalid email or password"
}
```

Jangan menjadikan contoh tersebut kontrak final sebelum memeriksa `error-handler.ts`.

Hal yang perlu diperiksa:
- Apakah error middleware mengembalikan `success`, `message`, `errors`, atau field lain.
- Apakah stack trace disembunyikan di production.
- Apakah error validasi Zod memiliki struktur khusus.
- Apakah error CSRF dan rate limit menggunakan format yang sama.

---

## 13. Rate Limiting

Route menggunakan middleware berikut:

| Endpoint | Middleware |
|---|---|
| Register | `registerLimiter` |
| Login | `loginLimiter` |
| Verify email | `verificationLimiter` |
| Resend verification | `resendVerificationLimiter` |
| Refresh | `refreshLimiter` |

Batas request, durasi window, key generator, dan response ketika limit tercapai belum dapat ditentukan karena file `auth-rate-limit.ts` belum disertakan.

---

## 14. Bruno Environment

Contoh environment:

```json
{
  "baseUrl": "http://localhost:3000/api/v1",
  "accessToken": "",
  "refreshToken": ""
}
```

Contoh request login:

```http
POST {{baseUrl}}/auth/login
Content-Type: application/json
Accept: application/json
```

```json
{
  "email": "budi@example.com",
  "password": "StrongPassword123"
}
```

Untuk endpoint protected:

```http
Authorization: Bearer {{accessToken}}
```

Untuk refresh, gunakan cookie refresh sesuai konfigurasi controller dan middleware CSRF. Jangan menyimpan refresh token di local storage.

---

## 15. Checklist Verifikasi

| Item | Status |
|---|---|
| Route method dan path relatif | Terverifikasi dari `auth.routes.ts` |
| Urutan middleware route | Terverifikasi dari `auth.routes.ts` |
| Request validation register/login/verify/resend | Terverifikasi dari `auth.validation.ts` |
| Register service result dan business logic | Terverifikasi dari `auth.service.ts` |
| Login service result dan business logic | Terverifikasi dari `auth.service.ts` |
| Verify email service result dan business logic | Terverifikasi dari `auth.service.ts` |
| Resend verification service result dan business logic | Terverifikasi dari `auth.service.ts` |
| Refresh service result dan rotation logic | Terverifikasi dari `auth.service.ts` dan repository |
| Logout service result | Terverifikasi dari `auth.service.ts` |
| Current user service result | Terverifikasi dari `auth.service.ts` |
| HTTP success status aktual | Belum diverifikasi — perlu `auth.controller.ts` |
| HTTP response envelope aktual | Belum diverifikasi — perlu `auth.controller.ts` |
| Cookie name, flags, domain, sameSite, secure, path | Belum diverifikasi — perlu controller/config |
| Error response JSON final | Belum diverifikasi — perlu error middleware |
| Rate limit values dan response | Belum diverifikasi — perlu `auth-rate-limit.ts` |
| Global route prefix | Perlu verifikasi file route mounting |
| Bruno end-to-end | Belum dikonfirmasi |

---

## 16. Source Tambahan yang Dibutuhkan untuk Finalisasi 100%

Kirim file berikut agar dokumentasi HTTP dapat dikunci tanpa asumsi:

```bash
for f in \
  src/modules/auth/auth.controller.ts \
  src/shared/middleware/error-handler.ts \
  src/shared/middleware/auth-rate-limit.ts \
  src/shared/middleware/csrf-protection.ts \
  src/shared/middleware/authenticate.ts \
  src/server.ts
do
  if [ -f "$f" ]; then
    echo "========== $f =========="
    cat "$f"
    echo
  fi
done
```

Jika route mounting tidak berada di `src/server.ts`, kirim juga file entry point/router aggregator yang memasang `auth.routes.ts`.

**Definisi selesai:** dokumentasi Auth dinyatakan 100% sesuai source setelah request, status HTTP, response JSON, cookie, error, dan middleware dicocokkan dengan controller serta konfigurasi aktual. Pengujian runtime tetap dicatat terpisah dari verifikasi source.
