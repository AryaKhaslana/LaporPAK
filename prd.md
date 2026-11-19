# PRD FINAL v3.3 — AUDIT-HARDENED & LOCKED
## LaporPAK! — Sistem Audit & Pelaporan Infrastruktur Publik Dua Arah Berbasis Peta

| Atribut Dokumen | Spesifikasi |
| :--- | :--- |
| **Nama Produk** | **LaporPAK!** (*Laporan Infrastruktur Publik & Audit Kolaboratif*) |
| **Versi Dokumen** | **v3.3 (PM Critical Review & Security-Hardened)** — Supersedes v3.2 |
| **Kompetisi & Sub-Tema** | Techcomfest 2027 — Sub-Tema 1: *Smart Governance & Public Service* (SDG 16) |
| **Batas Akhir & Cakupan** | 18 Desember 2026, 23.59 WIB $\mid$ Wilayah Kab. Sidoarjo & Kota Surabaya |
| **4 Instansi Mitra Utama** | Dishub, Dinas PU Bina Marga, DLH, dan Satpol PP |
| **Tim Eksekutor** | Arya, Fatih, dan Reza (Siap Eksekusi Monorepo LaporPAK) |

---

## Ringkasan Tinjauan Kritis PM (Audit v3.2 $\to$ v3.3)

Sebelum dokumen ini dikunci sebagai *Single Source of Truth*, tinjauan kritis terhadap **PRD v3.2** menemukan **8 celah lanjutan** di luar 18 poin yang sudah ditangani sebelumnya. Seluruh temuan di bawah ini telah diperbaiki dan diintegrasikan langsung ke dalam Bab 2–9 serta Lampiran A–B:

| Kategori Temuan | Kode | Masalah yang Ditemukan pada v3.2 | Solusi Penguncian di v3.3 |
| :--- | :--- | :--- | :--- |
| **Edge Case State** | **EC-19** | `isChronicOverdue` disebut "hanya aktif saat status `OVERDUE`", berisiko terhapus jika admin mengunggah foto palsu untuk masuk `PENDING_VALIDATION` sementara, serta belum ada kolom penyimpanan `remainingSlaMs` saat SLA dijeda. | `isChronicOverdue` dikunci sebagai flag permanen (*sticky boolean*: sekali bernilai `true`, tidak pernah kembali ke `false`). Ditambahkan kolom `remainingSlaMs` dan `validationStartedAt` pada model `Ticket`. |
| **Edge Case Voting** | **EC-20** | Jalur A (*Rework* biasa) dan Jalur B (*Ajukan Banding Bukti*) sama-sama menghasilkan `validationRound = 2` dengan `disputeCount = 1`, berisiko salah menjatuhkan penalti $-0.5$ ke pembantah Putaran 1 setelah Jalur A selesai. | Ditambahkan penanda eksplisit `isAppealRound` pada siklus validasi. Penalti $-0.5$ + *cooldown* $24\text{ jam}$ kepada pembantah Putaran 1 **hanya** dieksekusi jika `isAppealRound == true` dan putaran tersebut berakhir `CLOSED` oleh $\ge 2$ warga lain (bukan `AUTO_CLOSED`). |
| **Keamanan GPS & Nonce** | **SEC-21** | *Signed Capture Nonce* belum mengikat `actionType` (`CREATE` / `RESOLVE` / `DISPUTE`) dan `ticketId`, serta belum memvalidasi batas akurasi GPS (`accuracy`) secara ketat di server saat pengiriman foto. | Nonce (`jti`) wajib mengikat `{ userId, deviceFingerprint, actionType, ticketId }`, dikonsumsi sekali pakai via Redis `SETNX`, dan server menolak foto jika `gpsAccuracy > 50` meter (kecuali GPS Simulator Juri). |
| **Privasi Warga** | **PRV-22** | `AuditLog` memakai `actorId` (UUID internal) dalam rantai HMAC sehingga verifikasi publik berisiko membocorkan UUID asli warga; berkas `needsReview: true` yang disimpan di bucket publik dapat dienumerasi. | Hash HMAC menggunakan `actorPublicRef = HMAC-SHA256(AUDIT_SALT, userId)` (tidak membocorkan UUID/email). Kunci objek Storage memakai CSPRNG UUIDv4, EXIF/APPn/COM dipotong bersih, dan foto `needsReview: true` memakai *blurred derivative* sampai lolos moderasi. |
| **Keamanan Token Juri** | **SEC-23** | URL `?jury_token=...` dipublikasikan di `README.md` dan Video Demo; berisiko dipakai pihak luar untuk membanjiri tabel dengan ribuan data `isDemoData: true` atau memenuhi kuota Storage. | Sesi juri dibatasi *rate limit* khusus ($30$ mutasi / $10\text{ menit}$ per sesi/IP), batas maksimal $50$ tiket `isDemoData: true` aktif serentak, serta blokir akses ke `/aktivasi-mitra`. |
| **Anti-Spam Kategori** | **EC-24** | Kuota $3$ laporan per $50\text{ m}$ hanya mengecek kategori yang sama; spammer bisa mengirim $3$ laporan di tiap dari $8$ kategori ($24$ tiket) di titik yang sama, atau menumpuk tiket lintas hari. | Ditambahkan batas global maksimal $6$ tiket aktif lintas seluruh kategori dalam radius $30\text{ m}$, serta batas maksimal $5$ tiket aktif serentak dan $10$ tiket per $24\text{ jam}$ per akun `WARGA`. |
| **Ambiguitas Teknis** | **AMB-25** | Belum ada ambang numerik pasti untuk cek kecerahan (*luminance*) dan ketajaman (*sharpness*) Canvas, definisi batas waktu 48 jam vs 72 jam, aturan `OUT_OF_SCOPE` berlebih, dan larangan Pelapor Utama menekan *Dukung Prioritas*. | Dikunci ambang BT.601 Luminance ($Y \ge 35$ normal, $Y \ge 12$ malam kategori khusus, $Y \le 245$ anti-*overexposure*), Laplacian variance $\sigma^2 \ge 45$, *badge* peringatan jika `OUT_OF_SCOPE` instansi $> 25\%$, dan larangan pelapor mendukung tiketnya sendiri. |
| **Bug Spasial SQL** | **BUG-26** | `ST_DWithin` pada tipe `geometry(Point, 4326)` di PostGIS menghitung jarak dalam satuan **derajat** (bukan meter), yang akan meloloskan/memblokir seluruh dunia jika salah tipe kolom. | Seluruh kalkulasi radius ($30\text{ m}$, $50\text{ m}$, $75\text{ m}$, $100\text{ m}$) wajib menggunakan tipe `geography(Point, 4326)` pada PostGIS atau Haversine terverifikasi di backend. |

---

## BAB 1 — Pendahuluan, Masalah & Tiga Pilar Utama

**LaporPAK!** adalah platform web *civic-tech* berbasis peta interaktif untuk melaporkan kerusakan fasilitas umum (jalan berlubang, lampu PJU mati, saluran tersumbat, tumpukan sampah liar, hingga bahaya infrastruktur darurat) dengan mekanisme audit dua arah antara warga dan instansi pemerintah.

| Sisi Pengguna | Masalah Nyata di Lapangan | Solusi Terukur di LaporPAK! |
| :--- | :--- | :--- |
| **Masyarakat (Warga)** | Laporan sering menggantung tanpa kejelasan tenggat waktu atau statusnya ditutup sepihak (*fake closure*) padahal kondisi fisik belum diperbaiki. | *Public SLA Countdown* terbuka, masa Uji Publik $48\text{ jam}$ berbasis perbandingan foto Sebelum–Sesudah, serta hak Validasi 1-Tap dan Klaim Palsu dari warga radius $\le 100\text{ m}$. |
| **Pemerintah (Dinas)** | Instansi yang bekerja jujur sering kewalahan dibanjiri laporan hoaks, foto comotan internet, konten tidak senonoh (NSFW), foto tidak relevan, dan puluhan tiket ganda di satu titik yang sama. | Blokir galeri total pada foto lapangan (*WebRTC Live Camera*), Filter NSFW 2-Zona + Cek Piksel di client dan server, tombol Tolak Laporan Spam berpenalti bagi pelapor nakal, kuota maksimal $3$ laporan per radius $50\text{ m}$, serta hak Oper Tiket berbatas waktu. |

### Tiga Pilar Ekosistem

1. **Pilar Transparansi:** Setiap laporan memiliki hitung mundur tenggat waktu (*Public SLA*) terbuka dan riwayat perubahan status berantai kriptografi (`HMAC-SHA256`) yang mustahil diedit diam-diam di database tanpa terdeteksi.
2. **Pilar Aspirasi Terverifikasi:** Ketat di pintu masuk (wajib foto langsung di TKP, bebas NSFW, anti-duplikat) dan partisipatif di pintu keluar (warga sekitar ikut mengetuk palu sah atau tidaknya perbaikan per putaran).
3. **Pilar Stabilitas & Akuntabilitas:** Papan skor terbuka (`integrityScore` rentang $0\text{--}100$) yang secara objektif menghargai dinas tepat waktu, mencegah penalti ganda, dan menayangkan rasio `OUT_OF_SCOPE` serta `REJECTED_SPAM` secara transparan.

---

## BAB 2 — Arsitektur Peran, Privasi & Alur Autentikasi Multi-Role

Sistem menggunakan gerbang masuk satu pintu (`/login`) berbasis **Supabase Auth** dengan pemisahan wewenang ketat di level database Prisma dan penjaga rute frontend.

### A. Pembagian 4 Tipe Aktor

1. **Pengunjung Publik (Tanpa Login):** Bebas membuka `/`, `/tiket/:id`, dan `/rapor` untuk memantau peta, timer SLA, foto *before-after*, dan skor dinas. Tidak dapat membuat laporan, mendukung prioritas, atau melakukan validasi.
2. **Warga (`WARGA`):** Mendaftar bebas lewat registrasi email/password atau Google OAuth bawaan Supabase. Otomatis mendapatkan nama samaran publik acak (contoh: `Warga-Delta-402`) agar email, nama asli, dan UUID internal tidak pernah terekspos ke API publik maupun peta.
3. **Admin Instansi (`ADMIN_DINAS`):** Tidak dapat mendaftar dari form publik. Akun hanya tersedia melalui:
   - **Akun Mitra Bawaan (*Seed*):** `dishub@laporpak.id`, `dpu@laporpak.id`, `dlh@laporpak.id`, dan `satpolpp@laporpak.id` yang langsung terikat ke `departmentId` masing-masing dengan status `isVerifiedPartner: true`.
   - **Aktivasi Kerja Sama Mitra Baru (`/aktivasi-mitra` — target Bonus Minggu 4):** Instansi baru menerima Kode Aktivasi Sekali Pakai dari Super Admin (contoh: `MITRA-PU-2027`). Pejabat memasukkan email resmi dinas, password, dan kode rahasia; jika cocok, backend mengunci peran `ADMIN_DINAS` + `departmentId`, lalu menghanguskan kode.
   - **Skor Awal Mitra:** Seluruh instansi bawaan maupun mitra baru diinisialisasi pada `integrityScore = 80` (skala $0\text{--}100$) agar dinamika bonus ($+2$ / $+1$) maupun penalti ($-3$ / $-5$ / $-6$) langsung terukur sejak transaksi pertama.
4. **Sesi Simulasi Juri (`?jury_token=...`):** Mode pengujian dewan juri tersembunyi yang diverifikasi terhadap `JURY_SECRET_TOKEN` di server lalu menerbitkan *signed session token* (TTL $4\text{ jam}$) di `sessionStorage` + header `X-Jury-Token` dengan banner aktif.
   - **Isolasi Mutasi & Kuota Sesi Juri:** Seluruh endpoint mutasi wajib menolak (`403 Forbidden`) jika sesi juri mencoba mengubah data riil (`isDemoData: false`), memblokir akses ke `/aktivasi-mitra`, membatasi laju mutasi juri ($30$ mutasi per $10\text{ menit}$ per sesi/IP, maks $50$ tiket `isDemoData: true` aktif), dan otomatis menandai setiap *record* baru dari sesi juri sebagai `isDemoData: true`.

### B. Alur Teknis Login Pemerintah (*End-to-End*)

1. Petugas membuka `/login` dan memasukkan email dinas + password (tombol Google OAuth dikhususkan bagi warga).
2. Supabase Auth memverifikasi kredensial dan mengembalikan JWT `access_token`.
3. Frontend memanggil `GET /api/auth/me` dengan header `Authorization: Bearer <token>`.
4. Backend mencocokkan ID pengguna di Prisma dan mengembalikan `role: 'ADMIN_DINAS'`, `departmentId`, nama instansi, dan lencana `isVerifiedPartner: true`.
5. Router frontend otomatis mengalihkan petugas ke `/dinas`, menyembunyikan tombol *Lapor Kerusakan* serta laci profil warga, dan memblokir akses langsung ke URL `/lapor`.
6. Setiap aksi pada API dinas dikunci ketat dengan filter `where: { departmentId: req.user.departmentId }` (Dishub mustahil menyentuh tiket Dinas PU), seluruh aksinya dicatat ke `AuditLog`, dan tiap mutasi langsung menghapus (*invalidate*) cache Upstash Redis.

### C. Tata Kelola Privasi Data & Media Lapangan

- **Anonimitas API Publik:** Endpoint publik (`/api/tickets`, `/api/tickets/:id`, `/api/rapor`) dilarang mengembalikan `userId` (UUID), `email`, `deviceFingerprint`, maupun IP pengguna. Identitas ditampilkan hanya melalui `aliasName` dan `actorPublicRef` ter-hash.
- **Pencegahan Kebocoran Lokasi & Metadata:** Koordinat yang ditampilkan pada watermark foto dibulatkan ke $4$ desimal ($\approx 11\text{ m}$), seluruh segmen EXIF (`0xFFE1`), APPn (`0xFFE2`–`0xFFEF`), dan komentar JPEG (`0xFFFE`) dipotong di backend sebelum disimpan ke Supabase Storage dengan nama berkas acak CSPRNG UUIDv4 (`tickets/{ticketId}/{uuid}.webp`).
- **Panduan Privasi Kamera:** Antarmuka viewfinder WebRTC menampilkan pengingat singkat: *"Fokuskan kamera pada fasilitas rusak; hindari memotret wajah warga atau pelat nomor kendaraan."*

---

## BAB 3 — Siklus Hidup 10 Status Tiket (*State Machine* Tanpa Jalan Buntu)

Seluruh perubahan status di frontend, peta, dan backend wajib mengacu pada **10 status baku** berikut agar tidak ada tiket yang menggantung, terkena penalti berulang, atau melompat alur:

| No | Kode Status & Pin | Syarat Masuk | Timer SLA & Aturan Keluar (Transisi Lanjutan) |
| :--- | :--- | :--- | :--- |
| **1** | **`OPEN`** <br> Pin: Biru | Laporan valid warga lolos sensor NSFW 2-zona/piksel, geofencing, nonce, dan masuk DB. | Timer SLA berjalan sejak `createdAt` (atau `syncedAt` jika *offline*). Dinas boleh **Oper Tiket** maks $1\times$ (tanpa penalti) selama status masih `OPEN` dalam batas $\min(24\text{ jam}, 50\%\text{ SLA awal})$ ($= 12\text{ jam}$ untuk Darurat) + alasan wajib ($\ge 15\text{ karakter}$). Oper Tiket hanya memindahkan `departmentId` tanpa mengubah `category` asli, dan penerima mendapat buffer $\max(\text{Sisa SLA}, 12\text{ jam})$. Dapat pindah ke `IN_PROGRESS`, `OVERDUE`, `OUT_OF_SCOPE`, atau `REJECTED_SPAM`. |
| **2** | **`OUT_OF_SCOPE`** <br> Pin: Abu-abu | Dinas menandai laporan di luar wewenang 4 dinas Pemda (pilihan baku: PLN, PDAM, BPJN Nasional, BBWS, Telkom/Fiber, Lainnya) + catatan rujukan ($\ge 20\text{ karakter}$). | **Status Terminal.** Timer berhenti, tidak memengaruhi `integrityScore` dinas maupun `trustScore` pelapor. Semua keputusan dicatat di `AuditLog`, dan rasio `OUT_OF_SCOPE` tiap instansi ditampilkan terbuka di `/rapor` (lencana peringatan tampil jika rasio $> 25\%$). |
| **3** | **`REJECTED_SPAM`** <br> Pin: Abu Gelap *(Hidden)* | Dinas menekan *Tolak Laporan* (Spam / Tidak Relevan / Darurat Palsu) saat masih `OPEN` dalam batas $\min(24\text{ jam}, 50\%\text{ SLA awal})$ dihitung dari waktu pembuatan tiket + alasan wajib ($\ge 15\text{ karakter}$). | **Status Terminal.** Tiket hilang dari peta publik, foto dihapus permanen (*hard-delete*) dari Supabase Storage, dicatat di `AuditLog`, dan rasio `REJECTED_SPAM` tayang di `/rapor`. Pelapor kena $-0.5$ `trustScore` + *cooldown* $24\text{ jam}$. |
| **4** | **`IN_PROGRESS`** <br> Pin: Kuning | Petugas dinas menekan *Mulai Kerjakan* (dari `OPEN`) atau *Proses Perbaikan Ulang* (dari `DISPUTED` Jalur A). | Timer SLA berjalan (Oper Tiket & Tolak Spam tidak lagi tersedia). Pindah ke `PENDING_VALIDATION` saat petugas unggah foto bukti selesai *live* ($\le 75\text{ m}$), atau ke `OVERDUE` jika melewati `slaDeadline`. |
| **5** | **`OVERDUE`** <br> Pin: Merah | Waktu sekarang melewati `slaDeadline` saat status `OPEN` / `IN_PROGRESS` (dipicu *Lazy Evaluation* atomik saat `GET`/mutasi atau Cron harian cadangan). | Skor dinas dipotong $-3\text{ poin}$ (atau $-6\text{ poin}$ jika `supportCount` $\ge 10$), maks $1\times$ per tiket (`overduePenalized` flag). Jika keterlambatan aktif melampaui $100\%$ SLA awal ($\text{now} - \text{slaDeadline} > \text{slaInitialHours}$), sistem mengunci `isChronicOverdue = true` secara permanen (*sticky*) di `/rapor`. Petugas tetap wajib menyelesaikan & unggah bukti *live* ($\le 75\text{ m}$). |
| **6** | **`PENDING_VALIDATION`** <br> Pin: Oranye | Petugas unggah foto bukti perbaikan *live* ($\le 75\text{ m}$) yang lolos filter piksel & NSFW. | Sisa waktu SLA disimpan ke `remainingSlaMs` dan timer SLA dijeda (*paused*). `validationStartedAt` dicatat, `validationRound` bertambah $+1$, dan bobot kuorum (`weightAtVote`) dimulai dari $0$. Fase 1 Uji Publik ($0\text{--}48\text{ jam}$) dan Fase 2 Jendela Pelapor ($48\text{--}72\text{ jam}$) berjalan. Keluar ke: `CLOSED` (kuorum sah / konfirmasi pelapor jam $48\text{--}72$ khusus `disputeCount == 0`), `DISPUTED` (bantahan 1), `ESCALATED` (bantahan 2), atau `AUTO_CLOSED` (jam ke-$72$, atomik cek `version`). |
| **7** | **`DISPUTED`** <br> Pin: Ungu | Bantahan warga putaran ke-1 (`disputeCount = 1`) sah dengan foto bukti *live* ($\le 100\text{ m}$, lolos NSFW/piksel). Sistem mencatat `disputedAt`. | SLA dijeda maks $24\text{ jam}$ sejak `disputedAt`. Dinas wajib memilih 2 jalur: **(A)** *Proses Perbaikan Ulang* $\to$ `IN_PROGRESS` (`isAppealRound = false`) dengan `slaDeadline = now + max(0, remainingSlaMs) + 24 jam`; **(B)** Maks $1\times$, unggah foto sudut terbaru ($\le 75\text{ m}$) + *Ajukan Banding Bukti* kembali ke `PENDING_VALIDATION` (`validationRound++`, `disputeCount` tetap $1$, `isAppealRound = true`; pembantah putaran 1 dilarang ikut *voting*/bantah ke-2 di putaran banding — harus warga lain $\ge 1.0$; penalti $-0.5 + 24\text{ jam}$ kepada pembantah putaran 1 aktif **hanya** jika putaran banding `isAppealRound == true` berakhir `CLOSED` oleh $\ge 2$ warga lain). **Anti-Deadlock:** Jika $> 24\text{ jam}$ sejak `disputedAt` dinas diam, sistem otomatis memaksa Jalur A secara deterministik dengan `reworkStart = disputedAt + 24 jam` dan `slaDeadline = reworkStart + max(0, remainingSlaMs) + 24 jam`. |
| **8** | **`ESCALATED`** <br> Pin: Merah Tua / Hitam | Bantahan warga putaran ke-2 (`disputeCount = 2`) sah dengan foto bukti *live* ($\le 100\text{ m}$, lolos NSFW/piksel). | Penalti permanen $-5\text{ poin}$ `integrityScore` langsung dipotong. Dinas menutup titik dengan mengunggah 2 bukti: **Berita Acara Perbaikan Berjenjang** (PDF/JPG/PNG $\le 5\text{ MB}$) + **Foto Lapangan Live** ($\le 75\text{ m}$) $\to$ `CLOSED` berlabel *"Diselesaikan via Berita Acara Eskalasi"* (tanpa putaran bantahan ke-3; penalti $-5$ bersifat permanen). |
| **9** | **`CLOSED`** <br> Pin: Hijau | Kuorum warga ($\ge 3.0\text{ poin}$ DAN $\ge 2$ akun berbeda pada `validationRound` aktif), atau konfirmasi pelapor jam ke-$48\text{--}72$ (khusus `disputeCount == 0`), atau Berita Acara `ESCALATED`. | **Status Terminal.** Selesai tepat waktu tanpa pernah `OVERDUE`, `DISPUTED`, atau `ESCALATED` $\to$ dinas $+2\text{ poin}$ (`CLOSED` pasca-`DISPUTED` $= 0$ bonus; `integrityScore` dikunci pada rentang $[0, 100]$). Pelapor & validator putaran aktif (atau pembantah putaran 1 & 2 pada jalur `ESCALATED`) mendapat $+0.1$ `trustScore` (maks $2.0$). |
| **10** | **`AUTO_CLOSED`** <br> Pin: Hijau Muda | Lewat $72\text{ jam}$ ($48\text{ jam}$ uji publik + $24\text{ jam}$ jendela pelapor utama) tanpa bantahan dan tanpa respons pelapor (berlaku juga pada `disputeCount == 1` agar putaran ke-2 tidak *deadlock*; atomik cek `version`). | **Status Terminal.** Ditutup otomatis sistem agar tiket tidak menggantung selamanya. Dinas mendapat $+1\text{ poin}$ (hanya jika tidak pernah `OVERDUE` / `DISPUTED` / `ESCALATED`) dan pelapor mendapat $+0.1$ `trustScore` (maks $2.0$). Tidak memicu penalti pembantah Putaran 1. |

---

## BAB 4 — Aturan Main, Rumus Penilaian & Pengamanan

### A. Pintu Masuk Anti-Hoaks, Anti-NSFW & Anti-Duplikat

1. **Kuota Titik Spasial (`geography(Point, 4326)`):**
   - **Kuota Kategori Sama ($50\text{ m}$):** Maksimal $3$ laporan aktif (status bukan `CLOSED`, `AUTO_CLOSED`, `OUT_OF_SCOPE`, atau `REJECTED_SPAM`) pada `category` yang sama dalam radius $50\text{ meter}$ (`ST_DWithin` pada kolom `geography`).
   - **Kuota Global Lintas Kategori ($30\text{ m}$):** Maksimal $6$ laporan aktif lintas seluruh kategori dalam radius $30\text{ meter}$ untuk mencegah *category-cycling spam* di satu titik.
   - **Kuota Akun Warga:** Maksimal $5$ laporan aktif serentak per akun `WARGA` dan maksimal $10$ laporan per $24\text{ jam}$. Pengecekan kuota dilakukan saat membuka kamera dan diulang secara atomik di dalam transaksi `POST /api/tickets` (jika penuh, server menolak dengan `409 Conflict` + daftar tiket aktif sekitar agar UI mengarahkan ke *Dukung Prioritas*).
2. **Efek Dukung Prioritas (`POST /api/tickets/:id/support`):**
   - $1$ akun `WARGA` (bukan `reporterId` tiket tersebut dan bukan `ADMIN_DINAS`) hanya bisa mendukung $1\times$ per tiket, khusus saat status `OPEN` atau `IN_PROGRESS`.
   - Setiap kelipatan $10$ dukungan ($10, 20, 30, \dots$) memangkas sisa SLA sebesar $15\%$ **hanya jika** sisa SLA saat ini $> 6\text{ jam}$, dengan lantai batas minimal $6\text{ jam}$:
     $$\text{slaDeadline}_{\text{baru}} = \text{now} + \max\left(6\text{ jam},\; \text{sisaSLA} \times 0.85\right)$$
   - Begitu `supportCount` mencapai $\ge 10$, penalti keterlambatan (`OVERDUE`) digandakan satu kali dari $-3$ menjadi **$-6\text{ poin}$** (tetap maksimal $-6\text{ poin}$ meski dukungan mencapai $20$ atau lebih, dan tetap berlaku $-6\text{ poin}$ walau `supportCount` mencapai $10$ saat sisa SLA $\le 6\text{ jam}$).
3. **Tenggat Waktu SLA Otomatis per Kategori (Pemetaan Baku di Lampiran A):**
   - **Darurat ($24\text{ jam}$):** `JALAN_AMBLES`, `KABEL_MENJUNTAI`, `POHON_TUMBANG`.
   - **Menengah ($72\text{ jam}$):** `PJU_MATI`, `SAMPAH_LIAR`, `SALURAN_TERSUMBAT`, `REKLAME_LIAR`.
   - **Standar ($168\text{ jam}$ / $7\text{ hari}$):** `JALAN_BERLUBANG`.
4. **Kamera Live & Penyaringan 2 Lapis (Berlaku pada Pelaporan Warga, Bukti Selesai Dinas & Foto Bantahan):**
   - **Blokir Input Galeri:** `<input type="file">` diblokir mutlak untuk seluruh foto lapangan; wajib *WebRTC Live Camera* (`facingMode: "environment"` pada ponsel) dan menolak `MediaStreamTrack.label` kamera virtual (`OBS`, `ManyCam`, `Virtual`, `Snap Camera`, dll.). Satu pengecualian resmi: unggahan dokumen Berita Acara (`application/pdf`, `image/jpeg`, `image/png`, maks $5\text{ MB}$) khusus di form penyelesaian `ESCALATED` pada `/dinas`.
   - **Cek Kualitas Piksel (Canvas Kalibrasi Terukur):**
     - *Kecerahan (BT.601 Luminance $Y = 0.299R + 0.587G + 0.114B$, skala $0\text{--}255$):* Evaluasi jendela malam ($18.00\text{--}05.30\text{ WIB}$) wajib dikonversi ke zona waktu `Asia/Jakarta` ($\text{UTC}+7$). Foto ditolak jika terlalu terang/silau ($Y > 245$) atau terlalu gelap: $Y < 35$ untuk kondisi normal, dan dilonggarkan menjadi $Y < 12$ khusus jendela malam pada kategori `PJU_MATI` dan `SALURAN_TERSUMBAT`.
     - *Ketajaman Tepi (Laplacian Variance $\sigma^2_{\text{Lap}}$ pada sampel $256 \times 256$ grayscale):* Memblokir foto buram ekstrem atau lensa tertutup ($\sigma^2_{\text{Lap}} < 45$). Jika gagal $2\times$ berturut-turut pada sesi yang sama karena keterbatasan kamera perangkat, percobaan ke-$3$ diizinkan masuk dengan penanda `needsReview: true`.
   - **Filter NSFW 2-Zona (Client + Backend):** Pemeriksaan berjalan dua lapis menggunakan `nsfwjs` (TensorFlow.js) di client plus verifikasi API moderasi di backend (bila API eksternal *timeout* $> 4\text{ detik}$, *fail-safe* memakai skor client + menandai `needsReview: true`):
     1. *Zona Peringatan ($0.55\text{--}0.84$):* Mencegah *false positive* pada foto lumpur/aspal basah malam; UI meminta jepret ulang tanpa penalti.
     2. *Zona Tegas ($\ge 0.85$ / terkonfirmasi server):* Memblokir unggahan seketika sebelum masuk ke Supabase Storage + memotong $-0.5$ `trustScore` dan *cooldown* $24\text{ jam}$.
   - **Filter Relevansi (Dinas):** Foto yang lolos sensor NSFW namun tidak relevan (swafoto, tembok rumah, hewan peliharaan, atau klaim darurat palsu) dapat ditolak dinas lewat `REJECTED_SPAM` saat status `OPEN` dalam $\min(24\text{ jam}, 50\%\text{ SLA awal})$ sejak `createdAt` disertai alasan wajib; berkas dihapus permanen (*hard-delete*) dari Storage, rasio penolakan tayang di `/rapor`, dan pelapor kena $-0.5$ `trustScore` + *cooldown* $24\text{ jam}$.
5. **Geofencing, Nonce Terikat Aksi, Hardening Server & Antrean Offline:**
   - **Geofencing Sidoarjo–Surabaya:** Koordinat pada `POST /api/tickets` wajib berada di dalam poligon daratan Kab. Sidoarjo & Kota Surabaya ($+ \text{buffer } 500\text{ m}$, batas poligon ditampilkan di peta `/lapor` dari aset GeoJSON teroptimasi $\le 50\text{ KB}$; tolak `422 Unprocessable Entity` jika di luar, kecuali sesi GPS Simulator juri aktif).
   - **Dual-Mode Action-Bound Signed Capture Nonce & EXIF Strip:** Saat *online*, server menerbitkan *signed capture nonce* (TTL $15\text{ menit}$) yang mengikat `{ userId, deviceFingerprint, actionType, ticketId?, jti }` plus cadangan $2$ token *offline* (TTL $24\text{ jam}$, khusus `actionType: CREATE`) di IndexedDB. Setiap `jti` dikonsumsi secara atomik via Redis `SETNX` saat submit sehingga mustahil di-*replay* atau dipakai lintas tiket/aksi. Server memvalidasi akurasi GPS wajib $\le 50\text{ m}$, memeriksa *magic bytes* (`JPEG` / `WebP`), dimensi ($\le 1280\text{ px}$), ukuran ($\le 450\text{ KB}$), serta memotong segmen `EXIF` (`0xFFE1`), `APPn` (`0xFFE2`–`0xFFEF`), dan `COM` (`0xFFFE`).
   - **Tampilan `needsReview: true`:** Foto yang masuk lewat *fail-safe timeout* moderasi ($> 4\text{ detik}$) atau *override* ketajaman dirender melalui *blurred thumbnail* (*blur-by-default*, klik untuk melihat) di `/tiket/:id` hingga diverifikasi ulang.
   - **Watermark & Antrean Offline:** Foto diberi watermark jam WIB dan koordinat GPS $4$ desimal ($\approx 11\text{ m}$). Jika *offline*, laporan tersimpan di IndexedDB (akurasi GPS $\le 50\text{ m}$, kedaluwarsa $24\text{ jam}$, memakai $1$ token *offline* + `Idempotency-Key`); saat *online*, `slaDeadline` dihitung sejak `syncedAt` dan bentrok kuota $50\text{ m}$ ($3/3$) dialihkan ke *Dukung Prioritas*.

### B. Aturan Kuorum Validasi, Anti-Deadlock & Hak Suara

1. **Skema Bobot Reputasi Warga (`trustScore` $0.0\text{--}2.0$):**
   - Akun baru mulai dari $0.5\text{ poin}$ (mencegah serangan kloning akun).
   - Naik $1\times$ ke standar $1.0\text{ poin}$ setelah memiliki $1$ laporan atau validasi sah dengan syarat `violationCount == 0`.
   - Setiap kontribusi hingga status `CLOSED` (termasuk pembantah sah putaran 1 & 2 pada penutupan `ESCALATED`) atau `AUTO_CLOSED` (khusus pelapor) menambah $+0.1\text{ poin}$ (maks $2.0$).
   - Setiap pelanggaran (NSFW tegas, `REJECTED_SPAM`, atau bantahan palsu yang dibatalkan kuorum warga lain pada putaran banding `isAppealRound == true`) memotong $-0.5\text{ poin}$ (minimal $0.0$) + *cooldown* $24\text{ jam}$. Jika `trustScore` menyentuh $0.0$ atau terjadi $\ge 3$ pelanggaran dalam $30\text{ hari}$, akun terkena *freeze* $7\text{ hari}$ (mode baca saja). Pasca-*freeze* ($\text{now} > \text{frozenUntil}$), akun $0.0$ boleh membuat laporan baru ($+0.1$ tiap laporan berakhir `CLOSED` / `AUTO_CLOSED`), sedangkan tombol *Sudah Beres* dikunci hingga `trustScore` $\ge 0.5$ dan *Klaim Palsu* hingga $\ge 1.0$.
   - *Rate limit* ($> 5\text{ laporan/jam}$ khusus pelapor `WARGA` sebanyak $2\times$ berturut-turut) memicu *cooldown* $24\text{ jam}$ (tidak membatasi petugas `ADMIN_DINAS` saat menuntaskan tiket).
2. **Syarat Sah Penutupan (*Sudah Beres* 1-Tap):**
   - Wajib berada dalam radius $\le 100\text{ meter}$ dari titik tiket (akurasi GPS $\le 50\text{ m}$) dan dilakukan pada `validationRound` aktif. Suara per putaran bersifat final (tidak dapat diubah/dihapus).
   - **Snapshot Bobot (`weightAtVote`):** Nilai `trustScore` validator saat menekan tombol disimpan statis ke `TicketValidation.weightAtVote` agar perubahan skor di masa depan tidak mengubah status tiket lama secara retroaktif.
   - **Kuorum Sah Ganda:** Mensyaratkan DUA KONDISI SEKALIGUS pada putaran aktif:
     $$\sum \text{weightAtVote} \ge 3.0\text{ poin} \quad \text{DAN} \quad \text{Jumlah Akun Warga Sekitar Berbeda} \ge 2$$
     (dengan `userId` berbeda dan `deviceFingerprint` berbeda).
3. **Hak Suara & *Conflict of Interest* (Pelapor Utama vs Warga vs Dinas):**
   - **Fase 1 Uji Publik ($0\text{--}48\text{ jam}$ sejak `validationStartedAt`):** Pelapor Utama dilarang menekan *Sudah Beres* agar penilaian objektif oleh warga sekitar, namun tetap berhak klik *Klaim Palsu* sejak jam ke-$0$ ($\le 100\text{ m}$, `trustScore` $\ge 1.0$).
   - **Fase 2 Jendela Pelapor ($48\text{--}72\text{ jam}$ sejak `validationStartedAt`):** Warga sekitar tetap boleh melakukan validasi/bantahan. Jika kuorum belum tercapai dan `disputeCount == 0`, Pelapor Utama mendapat tombol konfirmasi 1-Tap *Sudah Beres* bebas radius. Jika `disputeCount >= 1`, tombol 1-tap pelapor tidak muncul, namun `AUTO_CLOSED` jam ke-$72$ tetap berjalan (bonus dinas $+0$).
   - **Larangan Mutlak:** Seluruh akun `ADMIN_DINAS` dilarang *voting*. Pada putaran banding Jalur B (`isAppealRound == true`), pembantah putaran 1 dilarang melakukan *vote* maupun bantahan ke-$2$ (hak bantah ke-$2$ pada putaran banding hanya untuk warga lain dengan `trustScore` $\ge 1.0$).
4. **Syarat Sah Bantahan (*Klaim Palsu* Anti-Deadlock):**
   - Wajib mengambil foto kamera *live* terbaru ($\le 100\text{ m}$, akurasi GPS $\le 50\text{ m}$, lolos sensor piksel & NSFW 2-zona) oleh akun dengan `trustScore` $\ge 1.0$ agar $1$ akun kloningan ($0.5$) tidak bisa menjatuhkan dinas namun warga jujur di jalan sepi tidak mengalami *deadlock*. Status langsung berpindah ke `DISPUTED` (putaran 1) atau `ESCALATED` (putaran 2).

### C. Lapisan Keamanan, Anti-Race Condition & Panel Juri

1. **Rantai Audit Kriptografi (`HMAC-SHA256` Tanpa Bocor UUID):** Setiap transisi status dan `OUT_OF_SCOPE` menulis baris berantai ke `AuditLog` menggunakan referensi aktor anonim `actorPublicRef = HMAC-SHA256(AUDIT_SALT, actorId)`. Manipulasi manual $1$ baris saja di database langsung terdeteksi sebagai `tampered` oleh endpoint verifikasi publik `GET /api/tickets/:id/audit-verify`:
   $$\text{currentHash} = \text{HMAC-SHA256}\left(\text{SERVER\_SECRET},\; \text{ticketId} \,\|\, \text{actorPublicRef} \,\|\, \text{action} \,\|\, \text{timestampMs} \,\|\, \text{prevHash}\right)$$
2. **Transaksi Anti-Race Condition:** Validasi dan *worker* transisi dibungkus transaksi Prisma memakai *row locking* (`SELECT FOR UPDATE`), *optimistic locking* (`version`), dan constraint unik `UNIQUE(ticketId, validatorId, validationRound)` sehingga suara putaran 1 terisolasi aman dari putaran 2 dan *worker* `AUTO_CLOSED` tidak pernah menabrak bantahan detik terakhir.
3. **Caching Redis, Anti-Fake GPS & Standar `deviceFingerprint`:** Upstash Redis menyimpan cache peta (TTL $45\text{ detik}$) dan rapor (TTL $180\text{ detik}$) dengan *explicit invalidation* (`DEL`) di setiap *write*/*reset*, mengonsumsi *capture nonce* (`SETNX`), dan memblokir *Impossible Travel* ($> 120\text{ km/jam}$ di seluruh aksi ber-GPS: buat tiket, selesai, validasi, bantahan — hanya dihitung jika kedua titik aksi berakurasi GPS $\le 50\text{ m}$). `deviceFingerprint` dibentuk dari SHA-256 gabungan sinyal perangkat keras (Canvas 2D + WebGL renderer + AudioContext + `hardwareConcurrency` + resolusi layar) ditambah `clientInstallId` lokal (agar dua HP model identik seperti iPhone sama tidak salah blokir, sekaligus mendeteksi tab *Incognito* serentak pada tiket sama via `X-Device-Fingerprint`).
4. **Panel Simulasi Juri (`?jury_token=...`):** Tersembunyi dari publik, persisten lintas rute via `sessionStorage` + header `X-Jury-Token`, dibatasi *rate limit* ($30\text{ mutasi} / 10\text{ menit}$, maks $50$ tiket simulasi aktif), dan dilengkapi $5$ alat uji cepat:
   1. *Role Switcher Instan:* Ganti peran $1$ klik (Warga Pelapor, Warga Validator, Admin Dishub, Admin PU, Admin DLH, Admin Satpol PP).
   2. *GPS Simulator:* Loncat koordinat ke lokasi tiket mana pun (otomatis melewati blokir *Impossible Travel* khusus sesi juri).
   3. *Simulasi Jepret Kamera Lapangan:* *Fallback* desktop tanpa webcam; menyuntikkan foto sampel realistis ke pipeline kompresi + watermark + sensor piksel/NSFW.
   4. *Percepat Waktu Tiket ($+25\text{ jam}$ / $+49\text{ jam}$):* Menggeser `slaDeadline` / `validationStartedAt` / `disputedAt` tiket agar juri dapat menguji `OVERDUE`, auto-*rework* `DISPUTED`, jendela $48\text{--}72\text{ jam}$, dan `AUTO_CLOSED` dalam hitungan detik.
   5. *Reset Demo (Isolasi `isDemoData`):* Mengembalikan data simulasi (`isDemoData: true`) dan skor $4$ dinas ke *clean seed* secara atomik (tanpa menghapus akun warga asli `isDemoData: false` yang mendaftar via Supabase Auth) sekaligus membersihkan cache Redis (`DEL`).

---

## BAB 5 — Matriks Kondisi Layar & Edge-Case UI (5 Halaman + 1 Drawer)

Tema visual memakai **Civic Tactical with Progressive Depth** (terang hangat di `/`, *Field Blueprint* di `/lapor` & `/tiket/:id`, dan gelap elegan *Deep Command Slate* `#0F172A` di `/rapor` & panel hash) bersama $2$ maskot orisinal **Cak Pantau** (Warga, kiri) dan **Mas Sigap** (Petugas, kanan).

| Halaman | Kondisi Normal (*Happy Path*) | Kondisi Ekstrem / Edge-Case & Perilaku UI |
| :--- | :--- | :--- |
| **`/`** <br> *(Beranda & Peta Publik)* | *Hybrid Hero* (tinggi $60\%$ viewport) dengan Cak Pantau & Mas Sigap + siluet jalan kota lokal, menyambung ke peta Leaflet & timer SLA. | **Filter Kosong:** Tampilkan pose maskot Siaga + tombol *"Reset Filter Peta"*. <br> **Koneksi Lambat:** Tampilkan *skeleton loader* peta & data cache terakhir Redis. |
| **`/lapor`** <br> *(Buat Laporan Baru)* | Geser pin $\to$ cek kuota radius lolos $\to$ buka WebRTC $\to$ jepret $\to$ kirim. | **Kuota Penuh ($3/3$ kategori sama di $50\text{ m}$ atau $6/6$ global di $30\text{ m}$, termasuk error `409` saat *sync*):** Kunci tombol kamera, munculkan daftar tiket aktif sekitar + tombol *Dukung Prioritas*. <br> **Foto Gelap/Blur/NSFW:** Zona $0.55\text{--}0.84$ atau blur pertama/kedua minta jepret ulang tanpa penalti; zona $\ge 0.85$ blokir total + tampilkan peringatan $-0.5$ & *cooldown*. <br> **Kamera Virtual / Tanpa Webcam:** Blokir perangkat OBS/Virtual; untuk juri ber-token muncul tombol *Simulasi Jepret Kamera Lapangan*. <br> **Offline / Freeze / Limit Akun:** Simpan ke IndexedDB (maks $24\text{ jam}$, SLA mulai saat `syncedAt`); akun *cooldown*/*freeze* atau mencapai batas $5$ tiket aktif terkunci dengan timer mundur. |
| **`/tiket/:id`** <br> *(Detail & Uji Publik)* | Foto Sebelum vs Sesudah berdampingan, bar kuorum putaran aktif ($x / 3.0\text{ poin}$ & jumlah validator), tombol validasi, dan panel hash `HMAC-SHA256`. | **GPS Luar Radius $100\text{ m}$ atau Akurasi $> 50\text{ m}$:** Tombol *Sudah Beres* & *Klaim Palsu* nonaktif dengan label jarak & akurasi aktual (kecuali Pelapor Utama pada jam $48\text{--}72$ untuk *Sudah Beres*). <br> **Pelapor Utama Jam $0\text{--}48$ vs $48\text{--}72$:** Jam $0\text{--}48$: *Sudah Beres* diganti banner warga sekitar (*Klaim Palsu* tetap aktif $\le 100\text{ m}$). Jam $48\text{--}72$: tombol 1-tap *Sudah Beres* bebas radius hanya muncul jika `disputeCount == 0`; bila `disputeCount >= 1`, banner kuorum warga tetap tampil. <br> **Foto `needsReview: true`:** Tampil *blur-by-default* dengan tombol konfirmasi buka gambar. <br> **Bukan `OPEN` / `IN_PROGRESS` atau Pelapor Sendiri:** Tombol *Dukung Prioritas* dinonaktifkan. <br> **Akun Baru ($0.5$), Pembantah Putaran 1 saat Banding, atau Konflik `409`:** Tooltip syarat `trustScore >= 1.0` / larangan banding pada *Klaim Palsu*; *toast* *"Status tiket baru saja diperbarui"* + *auto-refresh* saat `409`. |
| **`/dinas`** <br> *(Meja Kerja Pemerintah)* | Daftar tiket terurut dari `OVERDUE` & sisa SLA tersingkat; tombol *Mulai Kerjakan*, *Oper Tiket*, *Tolak Spam*, *Di Luar Wewenang*, dan *Laporkan Selesai*. | **Akses oleh Warga:** *Redirect* otomatis ke `/` dengan notifikasi akses terbatas. <br> **Oper Tiket & Tolak Spam Terkunci:** Nonaktif otomatis bila status bukan `OPEN` atau melewati $\min(24\text{ jam}, 50\%\text{ SLA awal})$ ($12\text{ jam}$ Darurat); Oper Tiket maks $1\times$. <br> **`OUT_OF_SCOPE` & `REJECTED_SPAM`:** Modal wajib isi instansi rujukan baku & alasan sebelum tersimpan. <br> **Tiket `DISPUTED`:** Tampilkan hitung mundur $24\text{ jam}$ batas respons sebelum auto-paksa ke `IN_PROGRESS`; tombol *Ajukan Banding Bukti* hilang permanen setelah $1\times$ dipakai. <br> **GPS Petugas $> 75\text{ m}$ / Tiket `ESCALATED`:** Tombol selesai terkunci bila $> 75\text{ m}$ (atau akurasi $> 50\text{ m}$); khusus `ESCALATED` mewajibkan $2$ unggahan: berkas Berita Acara ($\le 5\text{ MB}$) + Foto *Live* ($\le 75\text{ m}$). |
| **`/rapor`** <br> *(Rapor Instansi & Heatmap)* | Tema *Deep Command Slate*, papan skor $4$ instansi ($0\text{--}100$), rasio ketepatan SLA, jumlah `OVERDUE`, `ESCALATED`, rasio `OUT_OF_SCOPE` (dengan lencana peringatan bila $> 25\%$) & `REJECTED_SPAM`, serta peta panas Sidoarjo–Surabaya. | **Filter Kategori Nihil:** Grafik menampilkan angka $0$ secara bersih tanpa *error render* dan peta panas menampilkan *"Belum ada titik kerusakan di kategori ini"*. |
| **Profile Drawer** <br> *(Panel Geser)* | Menampilkan `aliasName`, bar `trustScore`, status *cooldown*/*freeze*, riwayat laporan & validasi, serta antrean *offline*. | **Ada Antrean Offline:** Menampilkan tombol manual *"Sinkronkan Sekarang"*, jumlah foto tertunda di IndexedDB, dan sisa masa berlaku draf $24\text{ jam}$. |

---

## BAB 6 — User Stories (Urut Sesuai Ketergantungan Teknis)

### Tahap 1 — Fondasi Database, Auth & Keamanan Inti
- **`US-001` (Skema Prisma + PostGIS `geography` & Seeding Wilayah):** $5$ model utama (`Department`, `User`, `Ticket`, `TicketValidation`, `AuditLog`) dengan $10$ enum status, $8$ enum kategori (Lampiran A), `@default(80)` pada `Department.integrityScore`, kolom `version`, `validationRound`, `isAppealRound`, `weightAtVote`, `remainingSlaMs`, `validationStartedAt`, `disputedAt`, `isChronicOverdue`, `overduePenalized`, `violationCount`, `isDemoData`, kolom spasial `geography(Point, 4326)`, constraint `UNIQUE(ticketId, validatorId, validationRound)`, serta `seed.ts` ($4$ dinas Sidoarjo–Surabaya, akun mitra, dan $25\text{--}30$ tiket simulasi `isDemoData: true` mencakup $10$ status + $1$ tiket jam ke-$50$).
- **`US-002` (Supabase Auth 1 Pintu, Alias Publik & Middleware Role):** Login/registrasi email & Google OAuth (`WARGA` + `aliasName` acak), $4$ akun `ADMIN_DINAS` seed, halaman bonus `/aktivasi-mitra`, proteksi `departmentId`, sanitasi UUID di endpoint publik, serta verifikasi *signed* `X-Jury-Token` ($4\text{ jam}$, blokir `403` mutasi data `isDemoData: false`, *rate limit* juri $30/10\text{ menit}$).
- **`US-003` (Rantai Hash `HMAC-SHA256` & Endpoint Verifikasi):** Menulis log audit berantai kriptografi menggunakan `actorPublicRef` pada setiap perubahan status (termasuk `OUT_OF_SCOPE` & `REJECTED_SPAM`) dan menyediakan `GET /api/tickets/:id/audit-verify`.
- **`US-004` (Lazy Evaluation Utama, Cron Cadangan & Upstash Redis):** *Lazy Evaluation* atomik (`version` check saat `GET`/mutasi) sebagai mesin utama transisi `OVERDUE` (maks $1\times$), sticky `isChronicOverdue` ($\text{now} - \text{slaDeadline} > \text{slaInitialHours}$), auto-*rework* `DISPUTED` ($> 24\text{ jam}$ deterministik), dan `AUTO_CLOSED` ($> 72\text{ jam}$), dibantu Vercel Cron harian untuk tiket pasif; cache peta ($45\text{ detik}$) & rapor ($180\text{ detik}$) dengan *explicit* `DEL`; konsumsi nonce `SETNX`; *rate limiter* `WARGA` ($5/\text{jam}$ & $10/24\text{ jam}$); *Impossible Travel* ($> 120\text{ km/jam}$ khusus GPS $\le 50\text{ m}$); serta `deviceFingerprint`.

### Tahap 2 — Mesin API Warga & Instansi
- **`US-005` (Cek Radius `geography`, Buat Tiket Atomik & Dukung Prioritas):** Endpoint `check-radius` ($50\text{ m}$ kategori sama maks $3$ & $30\text{ m}$ global maks $6$), pembuatan tiket atomik (re-cek kuota dalam transaksi, `409 Conflict` jika penuh, maks $5$ tiket aktif per akun) dengan `Idempotency-Key` dan SLA berdasar `syncedAt`, plus `POST /api/tickets/:id/support` (`OPEN` / `IN_PROGRESS`, bukan pelapor sendiri, pangkas $15\%$ hanya bila $\text{sisaSLA} > 6\text{ jam}$ dengan lantai $6\text{ jam}$, dan penalti maksimal $-6\text{ poin}$ saat dukungan $\ge 10$).
- **`US-006` (API Kerja Dinas Lengkap):** Endpoint `process`, `transfer` (`OPEN`, $\min(24\text{ jam}, 50\%\text{ SLA})$, $1\times$, buffer $\ge 12\text{ jam}$, wajib alasan), `out-of-scope` (wajib instansi rujukan baku + catatan), `reject-spam` (`OPEN` dalam $\min(24\text{ jam}, 50\%\text{ SLA})$ dari `createdAt`, wajib alasan, *hard-delete* foto dari Storage + $-0.5$ + $24\text{ jam}$), `resolve` ($\le 75\text{ m}$ + simpan `remainingSlaMs` + NSFW 2-zona), `reprocess-disputed` (`isAppealRound = false`, $\max(0, \text{remainingSlaMs}) + 24\text{ jam}$), `counter-dispute` ($1\times$, `isAppealRound = true`, tanpa reset `disputeCount`), dan `resolve-escalated` (Berita Acara $\le 5\text{ MB}$ + foto *live* $\le 75\text{ m}$).
- **`US-007` (API Validasi Warga $\le 100\text{ m}$ & Anti-Race Condition):** Transaksi `SELECT FOR UPDATE` + `version`, kuorum ganda ($\ge 3.0\text{ poin}$ DAN $\ge 2$ akun berbeda) di `validationRound` aktif, hak bantah Pelapor Utama jam $0\text{--}48$ ($\le 100\text{ m}$) + konfirmasi 1-tap jam $48\text{--}72$ (bebas radius), syarat `trustScore >= 1.0` untuk *Klaim Palsu*, serta vonis komunitas untuk penalti pembantah Putaran 1 **khusus** saat `isAppealRound == true` berakhir `CLOSED`.

### Tahap 3 — Antarmuka Custom, Kamera & Panel Juri
- **`US-008` (Design System Civic Tactical, Maskot & Profile Drawer):** Komponen UI $100\%$ *custom* Tailwind tanpa template, aset orisinal Cak Pantau & Mas Sigap, serta *Slide-Over Profile Drawer*.
- **`US-009` (Kamera Live WebRTC, Action-Bound Nonce/EXIF, Lazy `nsfwjs` & Offline):** Blokir galeri & kamera virtual, *Dual-Mode Action-Bound Signed Capture Nonce* (*online* $15\text{ menit}$ + $2$ token *offline* $24\text{ jam}$ di IndexedDB) + EXIF/APPn/COM *byte-strip* server, cek kecerahan `Asia/Jakarta` (BT.601) & ketajaman Laplacian Canvas, muat `nsfwjs` + `@tensorflow/tfjs` via `React.lazy()` / dynamic `import()` (Vite) hanya saat kamera dibuka, filter NSFW 2-zona (*blurred thumbnail* `needsReview: true`), kompresi $\le 450\text{ KB}$ + watermark GPS $4$ desimal, dan simpan *offline* IndexedDB ($24\text{ jam}$).
- **`US-010` (Panel Simulasi Juri `?jury_token=`):** *Role Switcher*, *GPS Simulator*, *Simulasi Jepret Kamera Lapangan*, *Percepat Waktu Tiket* ($+25\text{ jam}$ / $+49\text{ jam}$), dan *Reset Demo* (+ `DEL` Redis).
- **`US-011` s.d. `US-015` (5 Layar Inti Aplikasi):** Implementasi penuh `/`, `/lapor`, `/tiket/:id`, `/dinas`, dan `/rapor` beserta seluruh *edge-case* Bab 5.

---

## BAB 7 — Matriks Prioritas Pengerjaan (MVP Wajib Jadi vs Bonus)

Agar tim tidak kehabisan waktu menjelang tenggat **18 Desember 2026**, seluruh fitur dibagi ketat ke dalam dua tingkat prioritas:

| Prioritas | Daftar Fitur & Modul | Target Selesai |
| :--- | :--- | :--- |
| **WAJIB JADI** <br> *(MVP Inti Lomba)* | - Skema Prisma + PostGIS `geography` (`validationRound`, `isAppealRound`, `remainingSlaMs`, `version`, $8$ kategori, $10$ status) + $25\text{--}30$ data *seed* <br> - Auth 1 pintu Supabase (Warga + $4$ Akun Dinas) & Alias Publik <br> - $5$ Halaman Utama (`/`, `/lapor`, `/tiket/:id`, `/dinas`, `/rapor`) + Profile Drawer <br> - Peta Leaflet + geofencing GeoJSON + cek kuota atomik ($3/3$ kategori $50\text{ m}$ & $6/6$ global $30\text{ m}$) + *Dukung Prioritas* (*floor* $6\text{ jam}$) <br> - *WebRTC Live Camera* + kompresi Canvas + cek piksel terkalibrasi + Filter NSFW 2-zona + *Action-Bound Nonce* + `REJECTED_SPAM` *hard-delete* <br> - Alur penuh $10$ status (`DISPUTED` *rework* $\max(0, \text{sisa}) + 24\text{ jam}$, `ESCALATED` + Berita Acara PDF, kuorum ganda) <br> - Rantai hash `HMAC-SHA256` anonim, *Lazy Evaluation* SLA & *explicit cache invalidation* Redis <br> - Panel Simulasi Juri $5$ alat lengkap (Role + GPS + Fallback Kamera + Percepat Waktu + Reset Demo) <br> - $2$ Maskot utama (Cak Pantau & Mas Sigap) pose standar | **Minggu 1 – Minggu 3** <br> *(Kunci fitur: 12 Desember 2026)* |
| **BONUS** <br> *(Jika MVP $100\%$ Stabil)* | - $5$ variasi ekspresi pose dinamis untuk masing-masing maskot <br> - Halaman mandiri `/aktivasi-mitra` (kode undangan kerja sama dinas baru) <br> - Visualisasi *Heatmap* gradien kompleks di `/rapor` (MVP cukup klaster marker warna) <br> - Sinkronisasi antrean *offline* IndexedDB otomatis penuh (MVP cukup indikator koneksi + simpan draf lokal) <br> - Notifikasi email/*push* pengingat jam ke-$48$ ke Pelapor Utama (MVP cukup lencana notifikasi di dalam aplikasi) | **Minggu 4** <br> *(13–16 Des 2026, paralel produksi Video Demo)* |

---

## BAB 8 — Batasan Ruang Lingkup (*Non-Goals*) & Metrik Keberhasilan

### Yang Tidak Dibangun (*Out of Scope*)
- Tidak terhubung ke server/API internal instansi pemerintah asli (menggunakan database mandiri & data simulasi realistis Sidoarjo–Surabaya).
- Tidak membangun aplikasi *mobile native* Android/iOS (APK/IPA) maupun fitur ruang obrolan (*chat*) bebas.
- Tidak menyediakan tombol **Penurunan Kategori/SLA** oleh dinas (misal menurunkan `JALAN_AMBLES` $24\text{ jam}$ ke `JALAN_BERLUBANG` $168\text{ jam}$) agar oknum dinas tidak bisa menyabotase tenggat darurat; penyalahgunaan kategori darurat palsu ditangani via `REJECTED_SPAM` ($\le 12\text{ jam}$).

### Metrik Keberhasilan Kompetisi
- **Kinerja & Kestabilan (Bobot $30\%$):** Seluruh halaman & peta terbuka $< 2\text{ detik}$ di tautan Vercel publik (*Vercel Authentication* nonaktif) tanpa *error* konsol maupun gagal transaksi konkurensi.
- **Kelancaran Uji Juri:** Siklus penuh tuntas $< 3\text{ menit}$ lewat Panel Juri meski dari PC tanpa webcam; URL lengkap beserta `?jury_token=...` wajib dicantumkan di baris teratas `README.md` GitHub dan awal Video Demo.
- **Kepatuhan Rulebook:** $1$ GitHub Monorepo, UI $100\%$ *custom*, aset maskot orisinal, dan video demo Google Drive (akses *viewer*) terkumpul sebelum **18 Desember 2026, 23.59 WIB**.

---

## BAB 9 — Checklist Penguncian 26 Edge-Case & Anti-Eksploitasi (QA Master)

Tabel berikut merangkum seluruh **26 celah logika, keamanan, privasi & performa** (18 dari v3.2 + 8 tambahan dari Audit v3.3) sebagai daftar periksa wajib QA tim sebelum demo penjurian:

| No | Level | Celah yang Ditemukan | Solusi Terkunci di Spesifikasi (Bab 2–8) |
| :--- | :--- | :--- | :--- |
| **#1** | KRITIS | Konflik Kepentingan *Tolak Bantahan* & Loop | Dibatasi maks $1\times$ per tiket (`isAppealRound = true`), `disputeCount` tidak di-reset, dan penalti pembantah $-0.5 + 24\text{ jam}$ aktif **hanya** bila putaran banding berakhir `CLOSED` oleh $\ge 2$ warga lain. |
| **#2** | KRITIS | Tabrakan `UNIQUE(ticketId, validatorId)` Putaran ke-$2$ | Ditambah kolom `validationRound` (default $1$, naik $+1$ setiap masuk `PENDING_VALIDATION`), constraint diubah ke `UNIQUE(ticketId, validatorId, validationRound)`, dan kuorum di-reset ke $0$. |
| **#3** | KRITIS | SLA *Rework* `DISPUTED` Negatif & Double `OVERDUE` | Menyimpan `remainingSlaMs` saat masuk `PENDING_VALIDATION`; rumus *rework* dikunci ke $\max(0, \text{remainingSlaMs}) + 24\text{ jam}$, penalti `OVERDUE` maksimal $1\times$ (`overduePenalized`), dan evaluasi *Lazy Evaluation* atomik. |
| **#4** | KRITIS | *False Positive* `nsfwjs`, Bypass API & Kebocoran Foto | Diterapkan $2$ Zona Skor ($0.55\text{--}0.84$ ulang tanpa penalti; $\ge 0.85$ / server blokir $-0.5 + 24\text{ jam}$) di $3$ titik unggah foto + *fail-safe timeout* ($> 4\text{ detik}$ `needsReview: true`). Foto NSFW/`REJECTED_SPAM` dihapus permanen (*hard-delete*) dari Storage. |
| **#5** | TINGGI | *Stale Cache* Redis, Sesi `?jury_token` & Isolasi Reset Demo | Wajib `DEL` Redis tiap mutasi & Reset Demo; simpan token di `sessionStorage` + `X-Jury-Token`; Reset Demo hanya mereset baris `isDemoData: true` & skor $4$ dinas tanpa menyentuh akun warga riil. |
| **#6** | TINGGI | Ambiguitas Hak Pelapor Utama ($0\text{--}48\text{ jam}$ vs $48\text{--}72\text{ jam}$) | Pelapor Utama boleh *Klaim Palsu* sejak jam ke-$0$ ($\le 100\text{ m}$, `trustScore` $\ge 1.0$); di jam $48\text{--}72$ warga sekitar tetap bisa *vote*/bantah dan Pelapor Utama dapat konfirmasi 1-tap *Sudah Beres* bebas radius (khusus `disputeCount == 0`). |
| **#7** | TINGGI | Eksploitasi *Oper Tiket*, `OUT_OF_SCOPE` & `REJECTED_SPAM` Mepet SLA | *Oper Tiket* & `REJECTED_SPAM` hanya aktif di `OPEN` maks $\min(24\text{ jam}, 50\%\text{ SLA awal})$ sejak `createdAt` ($= 12\text{ jam}$ Darurat); buffer oper $\max(\text{Sisa SLA}, 12\text{ jam})$. `OUT_OF_SCOPE` & `REJECTED_SPAM` wajib isi rujukan/alasan, masuk `AuditLog`, dan tampil di `/rapor`. |
| **#8** | TINGGI | Rumus Skor, *Floor* $6\text{ jam}$, Pemulihan $0.0$ & Bonus Pembantah | `integrityScore` di-clamp $[0, 100]$; `AUTO_CLOSED` $+1$ dinas & $+0.1$ pelapor; `CLOSED` via `ESCALATED` beri $+0.1$ ke pelapor + pembantah putaran 1 & 2. Pangkas $15\%$ hanya jika $\text{sisaSLA} > 6\text{ jam}$, penalti dukungan $\ge 10$ dikunci $-6\text{ poin}$. Pasca-*freeze* $7\text{ hari}$, akun $0.0$ boleh melapor. |
| **#9** | MENENGAH | Kontradiksi Blokir `<input type="file">` vs Berita Acara | Blokir `<input type="file">` berlaku mutlak untuk foto lapangan, dengan $1$ pengecualian resmi: dokumen Berita Acara `ESCALATED` (PDF/JPG/PNG $\le 5\text{ MB}$) wajib didampingi Foto *Live* $\le 75\text{ m}$. |
| **#10** | MENENGAH | *Race Condition* Kuota $50\text{ m}$ & Draf Offline Basi | Re-cek kuota $50\text{ m}$ secara atomik di dalam transaksi `POST /api/tickets` (`409` *Dukung Prioritas*). Untuk *offline*, SLA dimulai dari `syncedAt`, kedaluwarsa $24\text{ jam}$, dan konflik kuota saat *sync* dialihkan ke dukungan. |
| **#11** | MENENGAH | *Mismatch* Timezone Vercel (UTC), Wi-Fi Sama & *Impossible Travel* | Jendela malam $18.00\text{--}05.30$ dievaluasi di `Asia/Jakarta` ($\text{UTC}+7$). Anti-Sybil pakai hash hardware/browser (`deviceFingerprint`). *Impossible Travel* ($> 120\text{ km/jam}$) hanya dihitung bila kedua titik aksi berakurasi GPS $\le 50\text{ m}$. |
| **#12** | MENENGAH | Belum Ada Pemetaan Tunggal Kategori $\leftrightarrow$ SLA $\leftrightarrow$ Dinas | Dikunci 1-ke-1 ke dalam $8$ kategori baku di Lampiran A sebagai satu-satunya acuan kode Prisma, dropdown UI, instansi *default*, durasi SLA, dan aturan foto malam. |
| **#13** | KRITIS | Penyalahgunaan `?jury_token=` Publik & Auto-Tagging Demo | Header `X-Jury-Token` memakai *signed token* server ($4\text{ jam}$), menolak (`403`) mutasi data `isDemoData: false`, dan otomatis menandai semua *record* baru dari sesi juri sebagai `isDemoData: true`. |
| **#14** | KRITIS | *Deadlock* `DISPUTED` Tanpa Batas Respons & Bonus Waktu Lazy Eval | Ditambahkan batas respons $24\text{ jam}$ sejak `disputedAt`; bila lewat, sistem otomatis memaksa Jalur A (`IN_PROGRESS`) secara deterministik ($\text{reworkStart} = \text{disputedAt} + 24\text{ jam}$, bukan `now`). |
| **#15** | KRITIS | Bypass API Kamera, EXIF GPS Bocor & Konflik Nonce vs Offline | Diterapkan *Dual-Mode Signed Capture Nonce* (*online* $15\text{ menit}$ + cadangan $2$ token *offline* $24\text{ jam}$ di IndexedDB), validasi *magic bytes* & dimensi + EXIF *byte-strip* (`0xFFE1`) di server, dan *blur-by-default* untuk `needsReview: true`. |
| **#16** | TINGGI | Konfirmasi Sepihak Pelapor Pasca-Bantahan & Sabotase Banding | Tombol 1-tap Pelapor Utama jam $48\text{--}72$ hanya aktif bila `disputeCount == 0`. Pada putaran banding Jalur B, pembantah putaran 1 dilarang *voting*/bantah ke-$2$ (harus warga lain $\ge 1.0$). |
| **#17** | TINGGI | Skor Awal Dinas $100$ & *False Flag* `isChronicOverdue` | Skor awal `Department.integrityScore` ditetapkan $80$. Penanda `isChronicOverdue = true` dikunci permanen (*sticky*) begitu keterlambatan aktif melewati $100\%$ SLA awal ($\text{now} - \text{slaDeadline} > \text{slaInitialHours}$). |
| **#18** | MENENGAH | Kuorum Retroaktif, Geofencing, *False-Positive* iPhone & Bundle `nsfwjs` | Simpan statis `weightAtVote`; validasi poligon Sidoarjo–Surabaya ($+ \text{buffer } 500\text{ m}$ & garis peta `/lapor`); `deviceFingerprint` gabung hardware hash + `clientInstallId` + cek *Incognito*; muat `nsfwjs` via `React.lazy()` / `import()` saat kamera dibuka. |
| **#19** | KRITIS | Hilangnya Sisa SLA Saat Pause & Reset `isChronicOverdue` *(Audit v3.3)* | Ditambahkan kolom `remainingSlaMs` dan `validationStartedAt`; `isChronicOverdue` dikunci sebagai *sticky boolean* yang tidak terhapus saat status berpindah ke `PENDING_VALIDATION`. |
| **#20** | KRITIS | Salah Penalti Pembantah Putaran 1 pada Jalur A *Rework* *(Audit v3.3)* | Ditambahkan boolean `isAppealRound` pada `Ticket`; penalti $-0.5 + 24\text{ jam}$ kepada pembantah Putaran 1 hanya berlaku jika `isAppealRound == true` dan berakhir `CLOSED` oleh $\ge 2$ warga lain. |
| **#21** | KRITIS | Nonce Lintas Aksi/Tiket & Spoofing Akurasi GPS Server *(Audit v3.3)* | *Capture nonce* (`jti`) diikat ketat ke `{ userId, deviceFingerprint, actionType, ticketId }`, dikonsumsi sekali pakai via Redis `SETNX`, dan server mewajibkan `gpsAccuracy <= 50` meter di seluruh endpoint foto. |
| **#22** | TINGGI | Kebocoran UUID pada `AuditLog` & Enumerasi File Storage *(Audit v3.3)* | Rantai HMAC memakai `actorPublicRef = HMAC-SHA256(AUDIT_SALT, actorId)` (UUID asli tidak pernah tampil di publik), kunci objek Storage memakai CSPRNG UUIDv4, dan aset `needsReview: true` menyajikan *blurred derivative*. |
| **#23** | TINGGI | *Flooding* Data Simulasi via Token Juri Publik *(Audit v3.3)* | Sesi juri dibatasi *rate limit* ($30\text{ mutasi} / 10\text{ menit}$ per sesi/IP), batas maksimal $50$ tiket `isDemoData: true` aktif, serta dilarang mengakses `/aktivasi-mitra`. |
| **#24** | MENENGAH | *Category-Cycling Spam* di Satu Titik & Penumpukan Tiket *(Audit v3.3)* | Ditambahkan kuota global maksimal $6$ tiket aktif lintas kategori dalam radius $30\text{ m}$, serta batas maksimal $5$ tiket aktif serentak dan $10$ tiket per $24\text{ jam}$ per akun `WARGA`. |
| **#25** | MENENGAH | Ambiguitas Ambang Piksel, Rasio `OUT_OF_SCOPE` & Self-Support *(Audit v3.3)* | Dikunci ambang BT.601 Luminance ($Y \ge 35$ normal, $Y \ge 12$ malam khusus, $Y \le 245$ anti-silau) & Laplacian $\sigma^2 \ge 45$; lencana peringatan pada `/rapor` jika `OUT_OF_SCOPE` $> 25\%$; pelapor dilarang menekan *Dukung Prioritas* pada tiket sendiri. |
| **#26** | KRITIS | Bug Satuan Derajat vs Meter pada PostGIS `ST_DWithin` *(Audit v3.3)* | Seluruh kolom koordinat spasial wajib bertipe `geography(Point, 4326)` sehingga `ST_DWithin` selalu menghitung jarak dalam satuan **meter** secara akurat. |

---

## LAMPIRAN A — Tabel Master Kategori Baku (*Single Source of Truth* FE & BE)

Tabel berikut mengunci pemetaan 1-ke-1 antara kode enum di database Prisma, tampilan di `/lapor`, instansi penerima otomatis, tenggat waktu SLA, dan aturan kelonggaran foto malam ($18.00\text{--}05.30\text{ WIB}$ `Asia/Jakarta`):

| Kode Enum (`category`) | Label Tampilan UI | Instansi Default | Tier & SLA | Kelonggaran Malam ($Y \ge 12$) |
| :--- | :--- | :--- | :--- | :--- |
| **`JALAN_AMBLES`** | Jalan Ambles Parah | Dinas PU Bina Marga | **DARURAT** ($24\text{ jam}$) | Tidak (Wajib terang / *flash*, $Y \ge 35$) |
| **`KABEL_MENJUNTAI`** | Kabel / Tiang Bahaya | Dishub | **DARURAT** ($24\text{ jam}$) | Tidak (Wajib terang / *flash*, $Y \ge 35$) |
| **`POHON_TUMBANG`** | Pohon Tumbang / Halang Jalan | DLH | **DARURAT** ($24\text{ jam}$) | Tidak (Wajib terang / *flash*, $Y \ge 35$) |
| **`PJU_MATI`** | Lampu PJU Mati | Dishub | **MENENGAH** ($72\text{ jam}$) | **Ya** ($18.00\text{--}05.30\text{ WIB}$, $Y \ge 12$) |
| **`SAMPAH_LIAR`** | Tumpukan Sampah Liar | DLH | **MENENGAH** ($72\text{ jam}$) | Tidak (Wajib terang / *flash*, $Y \ge 35$) |
| **`SALURAN_TERSUMBAT`** | Saluran Air / Drainase Tersumbat | Dinas PU Bina Marga | **MENENGAH** ($72\text{ jam}$) | **Ya** ($18.00\text{--}05.30\text{ WIB}$, $Y \ge 12$) |
| **`REKLAME_LIAR`** | Reklame / Bangunan Liar Bahaya | Satpol PP | **MENENGAH** ($72\text{ jam}$) | Tidak (Wajib terang / *flash*, $Y \ge 35$) |
| **`JALAN_BERLUBANG`** | Jalan / Aspal Berlubang | Dinas PU Bina Marga | **STANDAR** ($168\text{ jam}$) | Tidak (Wajib terang / *flash*, $Y \ge 35$) |

> **Catatan Operasional Pemetaan Kategori:** Jika pelapor memilih kategori yang di lapangan ternyata milik aset non-Pemda atau instansi berbeda (misal `KABEL_MENJUNTAI` milik PLN bukan Dishub, atau `POHON_TUMBANG` yang butuh penertiban Satpol PP), instansi penerima awal memiliki hak **Oper Tiket** (ke sesama $4$ dinas Pemda selama status `OPEN` dan $\le 12\text{ jam}$ untuk Darurat / $\le 24\text{ jam}$ non-Darurat) atau **`OUT_OF_SCOPE`** (rujukan ke PLN / PDAM / BPJN / BBWS / Telkom) sesuai Bab 3.

---

## LAMPIRAN B — Referensi Kontrak Endpoint API & Field Kunci Database

Untuk menyelaraskan implementasi antara frontend dan backend dalam Monorepo:

1. **Endpoint Autentikasi & Sesi:**
   - `GET /api/auth/me` — Mengembalikan profil ter-sanitasi (`aliasName`, `role`, `departmentId`, `trustScore`, `frozenUntil`, `cooldownUntil`).
   - `POST /api/jury/session` — Memverifikasi `jury_token` dan mengembalikan *signed session token* ($4\text{ jam}$) untuk header `X-Jury-Token`.
   - `POST /api/jury/reset` — Mengembalikan seluruh data `isDemoData: true` dan skor $4$ instansi ke kondisi awal + `DEL` cache Redis.
2. **Endpoint Kamera & Pelaporan Warga:**
   - `POST /api/capture-nonce` — Menerbitkan *signed capture nonce* terikat `{ actionType, ticketId?, deviceFingerprint }` + $2$ token cadangan *offline*.
   - `GET /api/tickets/check-radius?lat=...&lng=...&category=...` — Mengecek poligon geofencing + kuota $50\text{ m}$ ($3/3$) & $30\text{ m}$ ($6/6$) berbasis PostGIS `geography`.
   - `POST /api/tickets` — Transaksi atomik pembuatan laporan (validasi nonce `SETNX`, EXIF *strip*, NSFW 2-zona, kuota spasial & akun).
   - `POST /api/tickets/:id/support` — Menambah dukungan prioritas ($+1$), memangkas SLA $15\%$ tiap kelipatan $10$ (lantai $6\text{ jam}$), dan menaikkan flag penalti $-6\text{ poin}$.
   - `POST /api/tickets/:id/validate` — Validasi *Sudah Beres* ($\le 100\text{ m}$ atau pelapor jam $48\text{--}72$) dan bantahan *Klaim Palsu* ($\le 100\text{ m}$ + foto *live* + `trustScore >= 1.0`).
3. **Endpoint Kerja Instansi & Audit:**
   - `POST /api/tickets/:id/process` | `transfer` | `out-of-scope` | `reject-spam` | `resolve` | `reprocess-disputed` | `counter-dispute` | `resolve-escalated` — Seluruhnya dilindungi `where: { departmentId: req.user.departmentId }`, *optimistic lock* `version`, dan pencatatan `AuditLog`.
   - `GET /api/tickets/:id/audit-verify` — Memverifikasi keutuhan rantai hash `HMAC-SHA256` dari baris pertama hingga status terkini secara publik tanpa mengekspos UUID internal.