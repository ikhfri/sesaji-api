# Dokumentasi API — Food Matching Module

Dokumentasi ini disusun berdasarkan source code pada `src/modules/food-matching/`.

## 1. Ringkasan

Food Matching Module menyediakan rekomendasi food listing untuk pengguna dengan role `RECEIVER`.

Sistem mengambil:
- Profil receiver yang sudah memiliki verifikasi `RECEIVER` berstatus `APPROVED`.
- Lokasi default receiver yang aktif.
- Kebutuhan receiver yang aktif (`receiverNeeds`).
- Food listing aktif yang masih memiliki porsi tersedia dan belum melewati pickup deadline.

Listing kemudian disaring berdasarkan jarak dan kelayakan waktu, diberi skor kecocokan, lalu diurutkan dari skor tertinggi.

## 2. Endpoint

Prefix mount router tidak terlihat pada source yang diberikan. Path berikut merupakan path relatif terhadap router module.

### Mengambil rekomendasi makanan

`GET /recommendations`

**Autentikasi dan otorisasi**
- Wajib login melalui middleware `authenticate`.
- Hanya role `RECEIVER` yang diizinkan melalui middleware `authorize("RECEIVER")`.
- Controller juga memeriksa `req.auth`. Jika tidak tersedia, controller melempar HTTP 401 dengan pesan `Unauthenticated`.

**Request**
Tidak ada query parameter atau request body yang didefinisikan pada route ini.

```http
GET /recommendations
Authorization: Bearer <access_token>
```

**Response sukses — HTTP 200**

```json
{
  "success": true,
  "message": "Food recommendations retrieved successfully",
  "data": {
    "recommendations": [
      {
        "listingId": "uuid",
        "name": "Nama makanan",
        "description": "Deskripsi makanan",
        "category": "Nama kategori",
        "availablePortions": 10,
        "pickupDeadline": "2026-11-23T15:00:00.000Z",
        "locationLabel": "Lokasi pickup",
        "distanceKm": 2.35,
        "estimatedTravelMinutes": 8,
        "score": 87,
        "matchLabel": "SANGAT_COCOK",
        "reasons": [
          "Jarak 2.3 km",
          "10 porsi tersedia",
          "Kategori sesuai kebutuhan",
          "Estimasi perjalanan 8 menit"
        ]
      }
    ],
    "meta": {
      "total": 1,
      "radiusKm": 10,
      "travelTimeMethod": "STRAIGHT_LINE_ESTIMATE",
      "estimatedTravelMinutesPerKm": 3,
      "bufferMinutes": 30,
      "generatedAt": "2026-11-23T10:00:00.000Z"
    }
  }
}
```

Contoh nilai di atas hanya ilustrasi bentuk response berdasarkan interface dan controller, bukan data aktual.

## 3. Syarat receiver

Service memeriksa role sekali lagi. Jika role bukan `RECEIVER`, akan menghasilkan HTTP 403:

`Only receivers can access food recommendations`

Receiver harus memenuhi semua kondisi berikut:

1. Memiliki verifikasi dengan `verificationType = RECEIVER`.
2. Status verifikasi tersebut `APPROVED`.
3. Memiliki receiver profile.
4. Memiliki lokasi default yang terhubung dengan `userLocations`.
5. Relasi lokasi default tersebut dimiliki oleh user yang sama dan `isDefault = true`.
6. Akun user berstatus `ACTIVE`.

Jika konteks receiver tidak ditemukan, service menghasilkan HTTP 403:

`Approved receiver verification and a default location are required`

Koordinat latitude dan longitude lokasi default receiver dipakai sebagai titik asal perhitungan jarak.

## 4. Kandidat food listing

Repository mengambil listing yang memenuhi kondisi:
- `foodListings.status = ACTIVE`
- `availablePortions > 0`
- `pickupDeadline > waktu saat query dijalankan`

Data kandidat yang diambil meliputi:
- ID, nama, deskripsi listing.
- ID dan nama kategori.
- Porsi tersedia.
- Status halal dan vegetarian.
- Daftar alergen.
- Pickup deadline.
- Latitude, longitude, dan label lokasi.

Koordinat kandidat berasal dari relasi `foodListings.locationId` ke tabel `locations`.

## 5. Algoritma matching

### 5.1 Konfigurasi

Konfigurasi yang digunakan service:

| Opsi | Nilai | Fungsi |
|---|---:|---|
| `maxRadiusKm` | 10 km | Radius maksimal kandidat |
| `estimatedTravelMinutesPerKm` | 3 menit/km | Faktor estimasi waktu tempuh |
| `bufferMinutes` | 30 menit | Waktu buffer sebelum pickup deadline |

Algorithm juga memiliki default option yang sama jika fungsi dipanggil tanpa opsi.

### 5.2 Perhitungan jarak

Jarak dihitung menggunakan formula Haversine dengan radius bumi `6371 km`.

Input:
- Latitude dan longitude receiver.
- Latitude dan longitude lokasi listing.

Kandidat dengan jarak lebih dari 10 km dikeluarkan dari hasil.

Jarak yang ditampilkan pada response dibulatkan menjadi dua angka desimal.

### 5.3 Estimasi waktu perjalanan

Estimasi dihitung sebagai:

`ceil(jarak_km × 3 menit)`

Metode ini adalah estimasi garis lurus (`STRAIGHT_LINE_ESTIMATE`), bukan hasil routing jalan atau kondisi lalu lintas.

Kandidat juga harus memiliki waktu tersisa yang lebih besar daripada:

`estimasi waktu perjalanan + 30 menit buffer`

Jika waktu tersisa kurang dari atau sama dengan total tersebut, kandidat dikeluarkan sebelum scoring.

### 5.4 Receiver tanpa kebutuhan aktif

Jika receiver tidak memiliki `receiverNeeds` aktif, algorithm membuat satu kebutuhan default:

```json
{
  "categoryId": null,
  "requiredPortions": 1,
  "specialTags": []
}
```

Artinya, matching tetap dapat berjalan tanpa preferensi kategori atau tag khusus.

### 5.5 Komponen skor

Skor akhir merupakan gabungan lima komponen dengan bobot berikut:

| Komponen | Bobot | Perhitungan |
|---|---:|---|
| Jarak | 35% | `clamp(1 - distanceKm / maxRadiusKm)` |
| Kuantitas | 25% | `clamp(min(availablePortions, requiredPortions) / requiredPortions)` |
| Waktu | 20% | `clamp(1 - availableTimeAfterTravel / 240)` |
| Kategori | 10% | `1` jika kategori sesuai atau receiver tidak menetapkan kategori; selain itu `0` |
| Kebutuhan khusus | 10% | Jumlah tag terpenuhi dibagi jumlah seluruh tag; jika tidak ada tag, nilainya `1` |

`clamp(x)` membatasi nilai ke rentang 0 sampai 1.

Nilai `availableTimeAfterTravel` dihitung dari waktu tersisa sampai pickup deadline, dikurangi estimasi perjalanan dan buffer.

Skor akhir dibulatkan menjadi integer:

```text
round(
  100 * (
    0.35 * distanceScore +
    0.25 * quantityScore +
    0.20 * timeScore +
    0.10 * categoryScore +
    0.10 * specialNeedsScore
  )
)
```

### 5.6 Label kecocokan

| Skor | Label |
|---:|---|
| `>= 80` | `SANGAT_COCOK` |
| `>= 60` dan `< 80` | `COCOK` |
| `< 60` | `CUKUP_COCOK` |

Hasil akhir diurutkan berdasarkan `score` dari tertinggi ke terendah.

## 6. Tag kebutuhan khusus

Tag dinormalisasi dengan:
- Menghapus spasi di awal/akhir.
- Mengubah huruf menjadi uppercase.
- Mengganti spasi atau tanda hubung dengan underscore.

Tag yang didukung:

| Tag | Syarat listing |
|---|---|
| `HALAL` | `isHalal = true` |
| `VEGETARIAN` | `isVegetarian = true` |
| `NO_PEANUT` | Tidak memiliki alergen `peanut`, `peanuts`, atau `kacang_tanah` |
| `NO_DAIRY` | Tidak memiliki alergen `milk`, `dairy`, atau `susu` |
| `NO_EGG` | Tidak memiliki alergen `egg`, `eggs`, atau `telur` |
| `NO_SEAFOOD` | Tidak memiliki alergen `seafood`, `fish`, `shellfish`, `ikan`, `udang`, atau `kerang` |

Pencocokan alergen dilakukan setelah normalisasi: huruf menjadi lowercase dan spasi/tanda hubung menjadi underscore.

Tag yang tidak dikenal dianggap tidak terpenuhi (`false`), bukan otomatis dianggap cocok.

## 7. Alasan kecocokan (`reasons`)

Algorithm menyusun alasan berdasarkan hasil matching. Alasan yang dapat muncul:
- `Jarak X km`
- `X porsi tersedia`
- `Kategori sesuai kebutuhan` jika kategori cocok atau tidak ada batasan kategori.
- `Tidak ada batasan kategori` jika `categoryId` kebutuhan bernilai `null`.
- `N/M kebutuhan khusus terpenuhi` jika ada tag khusus dan minimal satu tag terpenuhi.
- `Kebutuhan khusus belum terpenuhi` jika ada tag khusus tetapi tidak ada yang terpenuhi.
- `Estimasi perjalanan X menit`

Nilai jarak pada teks alasan menggunakan satu angka desimal.

## 8. Error yang diketahui

| HTTP | Kondisi | Pesan |
|---:|---|---|
| 401 | Controller tidak menemukan `req.auth` | `Unauthenticated` |
| 403 | Role bukan `RECEIVER` | `Only receivers can access food recommendations` |
| 403 | Verifikasi receiver belum approved atau lokasi default/konteks receiver tidak tersedia | `Approved receiver verification and a default location are required` |

Bentuk JSON untuk error `AppError` bergantung pada global error handler dan tidak ditentukan oleh source module ini.

## 9. Catatan implementasi dan batasan

- Endpoint hanya menyediakan rekomendasi untuk receiver; tidak ada endpoint untuk donor atau volunteer pada router ini.
- Tidak ada parameter untuk mengatur radius, bobot skor, atau metode estimasi melalui request. Konfigurasi ditetapkan di service.
- Algorithm memilih kebutuhan receiver dengan skor tertinggi untuk setiap listing (`bestMatch`), bukan mengeluarkan satu hasil terpisah untuk setiap kebutuhan.
- Kebutuhan khusus dihitung sebagai bagian dari skor; tag yang tidak terpenuhi tidak menjadi hard filter. Kandidat tetap dapat muncul dengan skor lebih rendah.
- Filter jarak dan kelayakan waktu adalah hard filter: kandidat di luar radius atau tidak cukup waktu tidak akan diberi skor.
- Estimasi perjalanan berdasarkan jarak garis lurus dan faktor 3 menit/km, bukan jarak jalan aktual.
- Source module tidak menunjukkan definisi schema SQL tabel-tabel terkait atau prefix mount router di aplikasi utama.
- `generatedAt` dibuat ketika service membangun response.

