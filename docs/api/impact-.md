# Dokumentasi API — Impact Module

Dokumentasi ini disusun berdasarkan source code pada `src/modules/impact/`.

## 1. Ringkasan

Impact Module menyediakan dua jenis dashboard:

1. **Admin Impact Dashboard** — ringkasan dampak platform secara keseluruhan.
2. **Personal Impact Dashboard** — statistik dampak milik pengguna berdasarkan role: donor, receiver, atau volunteer.

Data dihitung dari tabel `food_requests`, `users`, `roles`, `delivery_tasks`, `food_listings`, dan `food_categories`.

## 2. Endpoint

Prefix mount router tidak terlihat pada source yang diberikan. Path di bawah merupakan path relatif terhadap router module.

### 2.1 Admin Impact Dashboard

`GET /admin`

**Autentikasi dan otorisasi**
- Wajib login (`authenticate`).
- Hanya role `ADMIN` (`authorize("ADMIN")`).

**Request**

Tidak menggunakan query parameter atau request body.

```http
GET /admin
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Impact dashboard retrieved successfully",
  "data": {
    "summary": {
      "totalPortionsDistributed": 1200,
      "completedDonations": 250,
      "activeDonors": 80,
      "activeReceivers": 100,
      "activeVolunteers": 20,
      "totalRequests": 300,
      "fulfillmentRate": 83.33,
      "averageDistributionTimeMinutes": 145.25
    },
    "generatedAt": "2026-11-23T10:00:00.000Z"
  }
}
```

Angka dan timestamp pada contoh hanya ilustrasi struktur response.

**Field summary**

| Field | Keterangan |
|---|---|
| `totalPortionsDistributed` | Total `requestedPortions` dari food request yang selesai |
| `completedDonations` | Jumlah food request berstatus `COMPLETED` dan memiliki `completedAt` |
| `activeDonors` | Jumlah akun aktif dengan role donor individu atau bisnis |
| `activeReceivers` | Jumlah akun aktif dengan role receiver |
| `activeVolunteers` | Jumlah akun aktif dengan role volunteer |
| `totalRequests` | Total seluruh food request tanpa filter status |
| `fulfillmentRate` | Persentase completed donations dibanding total requests |
| `averageDistributionTimeMinutes` | Rata-rata selisih `completedAt` dan `createdAt`, dalam menit |
| `generatedAt` | Waktu pembuatan response dalam ISO string |

**Rumus fulfillment rate**

```text
fulfillmentRate =
  (completedDonations / totalRequests) × 100
```

Hasil dibulatkan menjadi dua angka desimal. Jika `totalRequests` bernilai 0, hasilnya `0`.

**Kriteria perhitungan**
- Completed donations: `food_requests.status = COMPLETED` dan `completedAt IS NOT NULL`.
- Total portions: penjumlahan `requestedPortions` pada baris completed donations tersebut.
- Average distribution time: rata-rata `(completedAt - createdAt)` dalam menit pada baris completed donations.
- Active users: `users.accountStatus = ACTIVE`, lalu dikelompokkan berdasarkan nama role.

### 2.2 Personal Impact Dashboard

`GET /me`

**Autentikasi dan otorisasi**
- Wajib login (`authenticate`).
- Role yang diizinkan oleh route:
  - `DONOR_INDIVIDUAL`
  - `DONOR_BUSINESS`
  - `RECEIVER`
  - `VOLUNTEER`

**Request**

Tidak menggunakan query parameter atau request body.

```http
GET /me
Authorization: Bearer <access_token>
```

Response dibedakan berdasarkan role pengguna.

#### A. Donor — `DONOR_INDIVIDUAL` atau `DONOR_BUSINESS`

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Personal impact retrieved successfully",
  "data": {
    "role": "DONOR_INDIVIDUAL",
    "summary": {
      "completedDonations": 12,
      "totalPortions": 150,
      "averageCompletionMinutes": 120.5
    },
    "trend": [
      {
        "date": "2026-11-20",
        "completedDonations": 2,
        "totalPortions": 25
      }
    ],
    "trendPeriod": "LAST_30_DAYS"
  }
}
```

Contoh nilai hanya ilustrasi.

| Field | Keterangan |
|---|---|
| `role` | Role pengguna yang sedang login |
| `summary.completedDonations` | Jumlah food request completed pada listing milik donor |
| `summary.totalPortions` | Total porsi dari food request completed pada listing milik donor |
| `summary.averageCompletionMinutes` | Rata-rata waktu dari request dibuat sampai selesai |
| `trend` | Rekap harian jumlah completed donations dan porsi |
| `trendPeriod` | Konstanta `LAST_30_DAYS` |

Perhitungan donor menghubungkan `food_requests` dengan `food_listings`, lalu memfilter `foodListings.donorId = userId`, status request `COMPLETED`, dan `completedAt IS NOT NULL`.

Trend donor dibatasi pada completed request dengan `completedAt` dalam 30 hari terakhir. Pengelompokan hari menggunakan zona waktu `Asia/Jakarta`.

#### B. Receiver — `RECEIVER`

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Personal impact retrieved successfully",
  "data": {
    "role": "RECEIVER",
    "summary": {
      "completedDonations": 8,
      "totalPortions": 90,
      "averageCompletionMinutes": 95.75
    },
    "trend": [
      {
        "date": "2026-11-20",
        "completedDonations": 1,
        "totalPortions": 10
      }
    ],
    "trendPeriod": "LAST_30_DAYS"
  }
}
```

Contoh nilai hanya ilustrasi.

| Field | Keterangan |
|---|---|
| `role` | `RECEIVER` |
| `summary.completedDonations` | Jumlah food request completed milik receiver |
| `summary.totalPortions` | Total porsi dari food request completed milik receiver |
| `summary.averageCompletionMinutes` | Rata-rata waktu dari request dibuat sampai selesai |
| `trend` | Rekap harian jumlah completed donations dan porsi |
| `trendPeriod` | Konstanta `LAST_30_DAYS` |

Perhitungan receiver memfilter `foodRequests.recipientId = userId`, status `COMPLETED`, dan `completedAt IS NOT NULL`.

Trend receiver dibatasi pada completed request dengan `completedAt` dalam 30 hari terakhir. Pengelompokan hari menggunakan zona waktu `Asia/Jakarta`.

#### C. Volunteer — `VOLUNTEER`

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Personal impact retrieved successfully",
  "data": {
    "role": "VOLUNTEER",
    "summary": {
      "completedDeliveries": 15,
      "totalPortions": 180,
      "averageDeliveryMinutes": 42.5
    },
    "trend": [
      {
        "date": "2026-11-20",
        "completedDeliveries": 2,
        "totalPortions": 20
      }
    ],
    "trendPeriod": "LAST_30_DAYS"
  }
}
```

Contoh nilai hanya ilustrasi.

| Field | Keterangan |
|---|---|
| `role` | `VOLUNTEER` |
| `summary.completedDeliveries` | Jumlah delivery task completed milik volunteer |
| `summary.totalPortions` | Total porsi dari food request terkait delivery task |
| `summary.averageDeliveryMinutes` | Rata-rata waktu dari task ditugaskan sampai selesai |
| `trend` | Rekap harian jumlah completed deliveries dan porsi |
| `trendPeriod` | Konstanta `LAST_30_DAYS` pada response service |

Perhitungan volunteer menghubungkan `delivery_tasks` dengan `food_requests`, lalu memfilter:
- `deliveryTasks.volunteerId = userId`
- `deliveryTasks.status = COMPLETED`
- `foodRequests.status = COMPLETED`
- `deliveryTasks.completedAt IS NOT NULL`
- `deliveryTasks.assignedAt IS NOT NULL`
- `foodRequests.completedAt IS NOT NULL`

Rata-rata durasi delivery dihitung dari `(deliveryTasks.completedAt - deliveryTasks.assignedAt)` dalam menit.

**Catatan penting tentang trend volunteer:** pada query trend volunteer di repository tidak terlihat filter `completedAt` 30 hari terakhir. Meskipun service mengembalikan `trendPeriod: "LAST_30_DAYS"`, query trend volunteer mengelompokkan seluruh data yang memenuhi kondisi completed tanpa batas tanggal. Ini merupakan ketidaksesuaian antara metadata periode dan filter query yang perlu diperiksa.

## 3. Perhitungan trend

### Personal trend

Trend donor, receiver, dan volunteer menggunakan bucket tanggal:

- Tanggal diambil dari timestamp penyelesaian (`completedAt` untuk donor/receiver, `deliveryTasks.completedAt` untuk volunteer).
- Timestamp dikonversi dengan `AT TIME ZONE 'Asia/Jakarta'`.
- Format tanggal: `YYYY-MM-DD`.
- Data dikelompokkan dan diurutkan berdasarkan tanggal.
- Setiap bucket menghitung jumlah record selesai dan total porsi terkait.

Untuk donor dan receiver, query trend memiliki filter `completedAt >= getThirtyDaysAgo()`. Fungsi tersebut menghitung tanggal 30 hari sebelum waktu query dijalankan.

Untuk volunteer, filter tanggal tersebut tidak ada pada query trend yang diberikan.

### Admin dashboard

Admin dashboard hanya mengembalikan ringkasan agregat pada source module ini. Tidak ada trend harian atau bulanan pada endpoint `/admin`.

## 4. Error yang diketahui

| HTTP | Kondisi | Pesan |
|---:|---|---|
| 401 | Controller personal tidak menemukan `req.auth` | `Unauthenticated` |
| 403 | Role tidak memiliki personal dashboard | `Your role does not have a personal impact dashboard` |

Route `/admin` dilindungi `authorize("ADMIN")`. Bentuk response error untuk middleware `authorize` maupun `AppError` mengikuti implementasi middleware/global error handler dan tidak didefinisikan di controller Impact.

## 5. Catatan implementasi dan batasan

- Admin dashboard menjalankan tiga pengambilan metrik secara paralel menggunakan `Promise.all`.
- Personal dashboard memilih query berdasarkan role.
- Donor individu dan donor bisnis menggunakan perhitungan personal impact yang sama.
- Nilai agregat `null` dinormalisasi menjadi 0 melalui `coalesce` SQL atau fallback di JavaScript.
- Trend hanya mengembalikan tanggal yang memiliki data; source query tidak membuat bucket tanggal kosong.
- Total requests pada dashboard admin mencakup semua status request, bukan hanya request completed.
- `completedDonations` pada dashboard admin dihitung dari food requests berstatus `COMPLETED`, bukan dari jumlah food listing.
- `totalPortionsDistributed` dihitung dari `requestedPortions`, bukan dari jumlah porsi listing.
- `averageDistributionTimeMinutes` admin dan `averageCompletionMinutes` donor/receiver mengukur durasi dari request dibuat sampai selesai.
- `averageDeliveryMinutes` volunteer mengukur durasi dari task ditugaskan sampai task selesai.
- Source module tidak menunjukkan definisi schema tabel, prefix router saat mount ke Express, atau bentuk global error response.

## 6. Hal yang perlu diperhatikan

1. **Trend volunteer:** metadata menyebut `LAST_30_DAYS`, tetapi query trend tidak memiliki filter tanggal 30 hari. Jika memang yang diinginkan hanya 30 hari, repository perlu menambahkan filter pada query trend volunteer.
2. **Nama metrik:** `completedDonations` dipakai untuk menghitung food request completed pada donor dan receiver. Interpretasi angka sebaiknya mengikuti definisi query, bukan diasumsikan sebagai jumlah listing.
3. **Fulfillment rate:** pembilang adalah jumlah request completed yang memiliki `completedAt`, sedangkan penyebut adalah seluruh food request. Formula ini mengikuti implementasi service saat ini.

