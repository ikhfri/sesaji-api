# SESAJI API — Delivery Tasks Module

> Dokumentasi ini disusun berdasarkan source `delivery-tasks.routes.ts`, `delivery-tasks.service.ts`, `delivery-tasks.types.ts`, `delivery-tasks.validation.ts`, dan bagian repository yang tersedia. `delivery-tasks.controller.ts` tidak ada pada output yang dikirim, sedangkan bagian awal `delivery-tasks.repository.ts` terpotong. Karena itu, format response sukses, status HTTP sukses, dan detail query daftar task yang tidak terlihat tidak diasumsikan.

## 1. Ringkasan

Delivery Tasks Module mengelola proses pengantaran makanan oleh volunteer sampai receiver mengonfirmasi serah terima menggunakan handover code.

Alur status yang tampak pada implementasi:

```text
OPEN
  └── volunteer claim → ASSIGNED
        └── volunteer update → PICKED_UP
              └── volunteer update → DELIVERED
                    └── receiver confirm handover → COMPLETED
```

Status `CANCELLED` dan `EXPIRED` tercantum pada union type. Pada source yang tersedia, `EXPIRED` juga di-set ketika task kedaluwarsa saat volunteer mencoba claim. Mekanisme lain yang mengubah status menjadi `CANCELLED` tidak terlihat.

## 2. Authentication dan role

Semua route menggunakan middleware `authenticate`.

| Endpoint | Role dari route |
|---|---|
| `GET /available` | `VOLUNTEER` |
| `GET /me` | `VOLUNTEER` |
| `POST /:id/claim` | `VOLUNTEER` |
| `PATCH /:id/status` | `VOLUNTEER` |
| `POST /:id/confirm-handover` | `RECEIVER` |
| `GET /:id` | Semua role terautentikasi; akses kepemilikan diperiksa service |

Service juga melakukan pemeriksaan role untuk operasi volunteer dan receiver.

### Akses detail task

`GET /:id` hanya dapat diakses oleh:
- `ADMIN`
- Volunteer yang ditugaskan pada task
- Donor pemilik food listing
- Receiver pemilik food request

Jika bukan salah satu pihak tersebut, service mengembalikan HTTP 403.

**Perlindungan handover code:** field `handoverCode` hanya dikembalikan jika requester adalah receiver pemilik request. Untuk admin, volunteer, dan donor, service menghapus field tersebut dari object sebelum dikembalikan.

## 3. Daftar endpoint

Prefix mengikuti nama modul `/delivery-tasks`; mount path aktual pada entry point tidak tersedia.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/delivery-tasks/available` | Melihat task yang tersedia bagi volunteer |
| GET | `/delivery-tasks/me` | Melihat task milik volunteer yang login |
| POST | `/delivery-tasks/:id/claim` | Mengambil/claim task |
| PATCH | `/delivery-tasks/:id/status` | Memperbarui status task oleh volunteer |
| POST | `/delivery-tasks/:id/confirm-handover` | Receiver mengonfirmasi serah terima |
| GET | `/delivery-tasks/:id` | Melihat detail task |

## 4. Detail endpoint

### 4.1 GET `/delivery-tasks/available`

Mengambil daftar delivery task yang tersedia. Route hanya mengizinkan role `VOLUNTEER`.

Sebelum query daftar dijalankan, service memeriksa:
1. Volunteer profile harus ditemukan.
2. `isAvailable` harus bernilai `true`.
3. Volunteer harus memiliki verifikasi yang memenuhi syarat.

Pada repository claim, verifikasi yang disyaratkan secara eksplisit adalah `verificationType = VOLUNTEER` dan `status = APPROVED`. Untuk endpoint available, service menggunakan `findEligibleVolunteer` dan memeriksa `verificationStatus`; detail implementasi helper tersebut tidak ada pada bagian repository yang dikirim.

**Query parameters**

| Parameter | Tipe | Default | Validasi |
|---|---|---:|---|
| `page` | number | `1` | Dikonversi ke number, integer positif |
| `limit` | number | `20` | Dikonversi ke number, integer positif, maksimal 50 |

**Contoh request**

```http
GET /delivery-tasks/available?page=1&limit=20
Authorization: Bearer <access_token>
```

**Error yang didefinisikan service**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Role bukan volunteer | 403 | `Only volunteers can perform this action` |
| Volunteer profile tidak ditemukan | 404 | `Volunteer profile not found` |
| Volunteer belum mengaktifkan availability | 403 | `Set your volunteer availability before viewing tasks` |
| Verifikasi volunteer belum memenuhi syarat | 403 | `Volunteer verification is required` |

Bentuk response sukses dan detail filter/sort/pagination hasil query tidak dapat dipastikan karena controller dan bagian repository yang memuat `findAvailableTasks` tidak tersedia.

### 4.2 GET `/delivery-tasks/me`

Mengambil delivery task yang ditugaskan kepada volunteer yang sedang login.

**Role:** `VOLUNTEER`.

**Contoh request**

```http
GET /delivery-tasks/me
Authorization: Bearer <access_token>
```

Bagian repository yang tersedia menunjukkan hasil query:
- Difilter dengan `deliveryTasks.volunteerId = volunteerId`.
- Diurutkan berdasarkan `deliveryTasks.createdAt` descending.
- Mengambil informasi jadwal pickup, nama listing, requested portions, dan recipient ID melalui join ke food request, food listing, serta left join pickup schedule.

**Error**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Role bukan volunteer | 403 | `Only volunteers can perform this action` |

Controller tidak disertakan, sehingga status HTTP dan envelope response sukses tidak dapat diverifikasi.

### 4.3 POST `/delivery-tasks/:id/claim`

Volunteer mengambil satu task yang masih tersedia.

**Role:** `VOLUNTEER`.

**Path parameter:** `id` harus UUID valid.

**Contoh request**

```http
POST /delivery-tasks/550e8400-e29b-41d4-a716-446655440000/claim
Authorization: Bearer <access_token>
```

Tidak ada request body pada route ini.

**Aturan bisnis dan proses claim**

Proses dilakukan dalam transaksi:
1. Lock volunteer profile untuk menserialisasi claim yang dilakukan volunteer yang sama.
2. Pastikan volunteer profile ditemukan.
3. Pastikan volunteer `isAvailable = true`.
4. Pastikan ada verifikasi volunteer dengan `verificationType = VOLUNTEER` dan `status = APPROVED`.
5. Lock delivery task.
6. Task harus berstatus `OPEN`.
7. Jika `expiresAt` tersedia dan sudah lewat, task diubah menjadi `EXPIRED`, event `TASK_EXPIRED` dicatat, lalu proses claim ditolak.
8. Update task dengan `volunteerId`, status `ASSIGNED`, `assignedAt`, dan `updatedAt`.
9. Update menggunakan kondisi tambahan: task masih `OPEN` dan `volunteerId IS NULL`.
10. Catat event `TASK_CLAIMED` dengan actor volunteer, status sebelumnya `OPEN`, dan status baru `ASSIGNED`.

**Error**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Role bukan volunteer | 403 | `Only volunteers can perform this action` |
| Volunteer profile tidak ditemukan | 404 | `Volunteer profile not found` |
| Volunteer tidak tersedia | 409 | `You must be available to claim a task` |
| Verifikasi volunteer belum approved | 403 | `Volunteer verification is required` |
| Task tidak ditemukan | 404 | `Delivery task not found` |
| Task tidak lagi `OPEN` atau sudah diklaim | 409 | `Delivery task is no longer available` |
| Task kedaluwarsa | 410 | `Delivery task has expired` |
| Kegagalan tak terduga saat claim | 500 | `Failed to claim delivery task` |

Controller tidak disertakan; format response sukses dan status HTTP sukses tidak diketahui dari source yang tersedia.

### 4.4 PATCH `/delivery-tasks/:id/status`

Volunteer memperbarui progres delivery task.

**Role:** `VOLUNTEER`.

**Path parameter:** `id` harus UUID valid.

**Request body**

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `status` | string | Ya | `PICKED_UP` atau `DELIVERED` |
| `proofImageUrl` | string URL | Ya | URL valid, maksimal 2048 karakter |
| `notes` | string atau `null` | Tidak | Di-trim, maksimal 2000 karakter |

Body menggunakan schema `.strict()`, sehingga field tambahan ditolak.

**Contoh request — pickup**

```http
PATCH /delivery-tasks/550e8400-e29b-41d4-a716-446655440000/status
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "status": "PICKED_UP",
  "proofImageUrl": "https://example.com/proofs/pickup.jpg",
  "notes": "Makanan telah diambil dari donor"
}
```

**Contoh request — delivered**

```json
{
  "status": "DELIVERED",
  "proofImageUrl": "https://example.com/proofs/delivery.jpg",
  "notes": "Makanan telah sampai ke receiver"
}
```

**Transisi status yang diizinkan**

| Status sekarang | Status berikutnya |
|---|---|
| `ASSIGNED` | `PICKED_UP` |
| `PICKED_UP` | `DELIVERED` |

Transisi lain ditolak.

**Aturan saat `PICKED_UP`**
- Food request terkait harus masih berstatus `APPROVED`.
- Food request diubah menjadi `IN_PROGRESS`.
- Delivery task diubah menjadi `PICKED_UP`.
- `pickedUpAt` diisi waktu saat ini.

**Aturan saat `DELIVERED`**
- Delivery task diubah menjadi `DELIVERED`.
- `deliveredAt` diisi waktu saat ini.

Setiap update mencatat row `taskEvents` dengan:
- `eventType`: `TASK_PICKED_UP` atau `TASK_DELIVERED`.
- `previousStatus` dan `newStatus`.
- `proofImageUrl`.
- `notes` (atau `null` jika tidak dikirim).
- `actorId` volunteer.

Update task dan request/event dilakukan dalam transaksi. Jika update task gagal setelah request diubah, repository melempar error agar transaksi sebelumnya di-rollback.

**Error**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Role bukan volunteer | 403 | `Only volunteers can perform this action` |
| Task tidak ditemukan | 404 | `Delivery task not found` |
| Task bukan milik volunteer tersebut | 403 | `This task is not assigned to you` |
| Transisi status tidak valid | 409 | `Invalid delivery task status transition` |
| Food request bukan dalam status yang diharapkan saat pickup | 409 | `Food request is not in the expected state for pickup` |
| Kegagalan tak terduga | 500 | `Failed to update delivery task` |

### 4.5 POST `/delivery-tasks/:id/confirm-handover`

Receiver mengonfirmasi bahwa makanan telah diterima dengan memasukkan handover code.

**Role:** `RECEIVER`.

**Path parameter:** `id` harus UUID valid.

**Request body**

| Field | Tipe | Wajib | Validasi |
|---|---|---|---|
| `handoverCode` | string | Ya | Harus tepat 4 digit angka (`^\d{4}$`) |

Body strict.

**Contoh request**

```http
POST /delivery-tasks/550e8400-e29b-41d4-a716-446655440000/confirm-handover
Authorization: Bearer <access_token>
Content-Type: application/json
```

```json
{
  "handoverCode": "0427"
}
```

**Aturan bisnis**
1. Task harus ditemukan dan memiliki relasi food request serta pickup schedule.
2. User yang mengonfirmasi harus merupakan receiver pemilik food request.
3. Status delivery task harus `DELIVERED`.
4. Handover code harus cocok dengan `pickupSchedules.handoverCode`.
5. Food request harus berstatus `IN_PROGRESS`, lalu diubah menjadi `COMPLETED`; `completedAt` dan `updatedAt` diisi.
6. Delivery task diubah dari `DELIVERED` menjadi `COMPLETED`; `completedAt` dan `updatedAt` diisi.
7. Event `HANDOVER_CONFIRMED` dicatat dengan actor receiver, previous status `DELIVERED`, new status `COMPLETED`.
8. Proses berjalan dalam transaksi dengan row lock pada delivery task.

**Error**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Role bukan receiver | 403 | `Only receivers can confirm food handover` |
| Task tidak ditemukan | 404 | `Delivery task not found` |
| Task bukan milik receiver tersebut | 403 | `This delivery task does not belong to you` |
| Task belum berstatus `DELIVERED` | 409 | `Delivery task has not been marked as delivered` |
| Handover code salah atau tidak tersedia | 422 | `Invalid handover code` |
| Food request bukan `IN_PROGRESS` | 409 | `Food request is not in progress` |
| Kegagalan tak terduga | 500 | `Failed to confirm food handover` |

Controller tidak disertakan, sehingga envelope dan status HTTP sukses tidak dapat diverifikasi.

### 4.6 GET `/delivery-tasks/:id`

Mengambil detail delivery task beserta event history.

**Akses:** semua user terautentikasi yang lolos pemeriksaan ownership di service (admin, volunteer yang ditugaskan, donor pemilik listing, atau receiver pemilik request).

**Path parameter:** `id` harus UUID valid.

**Contoh request**

```http
GET /delivery-tasks/550e8400-e29b-41d4-a716-446655440000
Authorization: Bearer <access_token>
```

Repository mengambil data task yang mencakup:
- ID task, request, volunteer, dan status.
- Timestamp assigned, picked up, delivered, completed, cancelled, expiry.
- Cancellation reason, createdAt, updatedAt.
- Recipient ID dan requested portions.
- Donor ID, listing ID, nama dan deskripsi listing.
- Jadwal pickup dan handover code (left join pickup schedule).
- Alamat serta koordinat pickup dari location.
- Event history yang diurutkan berdasarkan `createdAt` ascending.

**Perlindungan data:** service hanya menyertakan `handoverCode` untuk receiver pemilik request. Field tersebut dihilangkan dari hasil untuk admin, volunteer, dan donor.

**Error**

| Kondisi | HTTP | Pesan |
|---|---:|---|
| Task tidak ditemukan | 404 | `Delivery task not found` |
| User bukan pihak yang berhak mengakses | 403 | `You are not allowed to access this delivery task` |
| ID bukan UUID valid | 400 | `Invalid delivery task ID` |

Controller tidak disertakan, sehingga status dan envelope response sukses tidak diketahui.

## 5. Status dan event

### Status delivery task

Union type yang didefinisikan:

| Status | Keterangan |
|---|---|
| `OPEN` | Task tersedia untuk diklaim |
| `ASSIGNED` | Task telah diambil volunteer |
| `PICKED_UP` | Makanan telah diambil volunteer |
| `DELIVERED` | Makanan telah diantar |
| `COMPLETED` | Serah terima telah dikonfirmasi receiver |
| `CANCELLED` | Status tersedia pada type; mekanisme perubahan tidak tampak di source yang diberikan |
| `EXPIRED` | Task kedaluwarsa; pada proses claim, task OPEN yang melewati `expiresAt` diubah ke status ini |

### Event yang dicatat pada source tersedia

| Event type | Actor | Previous → New |
|---|---|---|
| `TASK_EXPIRED` | `null` | `OPEN` → `EXPIRED` |
| `TASK_CLAIMED` | Volunteer | `OPEN` → `ASSIGNED` |
| `TASK_PICKED_UP` | Volunteer | `ASSIGNED` → `PICKED_UP` |
| `TASK_DELIVERED` | Volunteer | `PICKED_UP` → `DELIVERED` |
| `HANDOVER_CONFIRMED` | Receiver | `DELIVERED` → `COMPLETED` |

## 6. Validasi

### Task ID

`deliveryTaskParamsSchema` memvalidasi `id` sebagai UUID. Route mengembalikan HTTP 400 dengan pesan `Invalid delivery task ID` jika validasi gagal. `errors` berisi issue array dari Zod.

### Available tasks query

- `page`: integer positif, default 1.
- `limit`: integer positif, maksimal 50, default 20.
- Nilai query dikonversi menjadi number.

### Update status

- `status`: hanya `PICKED_UP` atau `DELIVERED`.
- `proofImageUrl`: URL valid, maksimal 2048 karakter.
- `notes`: opsional, nullable, di-trim, maksimal 2000 karakter.
- Body strict.

### Confirm handover

- `handoverCode`: string tepat 4 digit.
- Body strict.

Format response error dari middleware `validate`, `validateQuery`, `authenticate`, dan `authorize` tidak terlihat pada source yang tersedia.

## 7. Contoh pengujian di Bruno

Gunakan environment variable `baseUrl`, `token`, dan `taskId`.

**Available tasks**

```http
GET {{baseUrl}}/delivery-tasks/available?page=1&limit=20
Authorization: Bearer {{token}}
```

**My delivery tasks**

```http
GET {{baseUrl}}/delivery-tasks/me
Authorization: Bearer {{token}}
```

**Claim task**

```http
POST {{baseUrl}}/delivery-tasks/{{taskId}}/claim
Authorization: Bearer {{token}}
```

**Update to picked up**

```http
PATCH {{baseUrl}}/delivery-tasks/{{taskId}}/status
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "status": "PICKED_UP",
  "proofImageUrl": "https://example.com/proofs/pickup.jpg",
  "notes": "Makanan telah diambil"
}
```

**Update to delivered**

```http
PATCH {{baseUrl}}/delivery-tasks/{{taskId}}/status
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "status": "DELIVERED",
  "proofImageUrl": "https://example.com/proofs/delivery.jpg",
  "notes": "Makanan telah diserahkan kepada receiver"
}
```

**Confirm handover (receiver)**

```http
POST {{baseUrl}}/delivery-tasks/{{taskId}}/confirm-handover
Authorization: Bearer {{token}}
Content-Type: application/json
```

```json
{
  "handoverCode": "0427"
}
```

**Task detail**

```http
GET {{baseUrl}}/delivery-tasks/{{taskId}}
Authorization: Bearer {{token}}
```

## 8. Catatan implementasi dan batas dokumentasi

- `delivery-tasks.controller.ts` tidak disertakan. Karena itu, response sukses, HTTP status sukses, dan pesan sukses tidak ditebak.
- Bagian awal `delivery-tasks.repository.ts` terpotong. Implementasi `findAvailableTasks`, `findEligibleVolunteer`, dan awal `findVolunteerTasks` tidak tersedia secara utuh; filter, sorting, pagination query, serta detail response daftar available tasks belum dapat dipastikan.
- Route `GET /:id` tidak memakai `authorize(...)`, tetapi service menerapkan pemeriksaan admin/volunteer/donor/receiver ownership.
- Handover code disembunyikan dari selain receiver pemilik request pada service detail.
- Claim memeriksa availability dan verifikasi volunteer approved, lalu mengunci task agar tidak diklaim bersamaan.
- Perubahan status pickup juga mengubah Food Request dari `APPROVED` ke `IN_PROGRESS`.
- Konfirmasi handover menyelesaikan Food Request dan Delivery Task dalam satu transaksi.
- Type status mencakup `CANCELLED`, tetapi endpoint dan alur cancel tidak terlihat pada route/service yang dikirim.
- Source schema database, controller, middleware, serta implementasi helper repository yang hilang perlu diperiksa untuk melengkapi dokumentasi tanpa asumsi.
