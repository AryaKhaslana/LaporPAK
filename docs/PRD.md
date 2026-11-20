Sinkron

LaporPAK/prd.md

· Siap Eksekusi

PRD FINAL v3.4 — FINAL LOCKED (LAST REVISION)

## LaporPAK! — Product Requirements Document

Sistem Audit & Pelaporan Infrastruktur Publik Dua Arah Berbasis Peta

KOMPETISI & SUB-TEMA

Techcomfest 2027 — Sub-Tema 1

Smart Governance & Public Service (SDG 16) Kab. Sidoarjo & Kota Surabaya

BATAS AKHIR & WILAYAH

4 INSTANSI MITRA

18 Desember 2026, 23.59 WIB

Dishub, Dinas PU Bina Marga, DLH, dan Satpol PP

## Status Dokumen (Final Locked v3.4 — Revisi Terakhir Sebelum Coding)

Dokumen ini menggabungkan seluruh 26 penguncian v3.3 ditambah 6 celah penutup terakhir ( #27–#32 ) langsung ke Bab 1–9 serta Lampiran A & B (17 kontrak endpoint). Seluruh isi 100% identik dengan LaporPAK/prd.md sebagai Single Source of Truth terakhir menuju Feature Freeze MVP: 12 Desember 2026.

## BAB 1 Pendahuluan, Masalah & Tiga Pilar Utama

LaporPAK! adalah platform web civic-tech berbasis peta interaktif untuk melaporkan kerusakan fasilitas umum (jalan berlubang, lampu PJU mati, saluran tersumbat, tumpukan sampah liar, hingga bahaya infrastruktur darurat) dengan mekanisme audit dua arah antara warga dan instansi pemerintah.

| Sisi Pengguna | Masalah Nyata di Lapangan | Solusi Terukur di LaporPAK! |
| --- | --- | --- |
| Masyarakat | Laporan sering menggantung tanpa kejelasan | Public SLA Countdown terbuka, masa Uji Publik 48 |
| (Warga) | tenggat waktu atau statusnya ditutup sepihak (fake | Jam berbasis perbandingan foto Sebelum–Sesudah, |
|   | closure) padahal kondisi fisik belum diperbaiki. | serta hak Validasi 1-Tap dan Klaim Palsu dari warga |
|   |   | radius ≤100 m . |
| Pemerintah | Instansi yang bekerja jujur sering kewalahan dibanjiri | Blokir galeri total foto lapangan (WebRTC Live |
| (Dinas) | laporan hoaks, foto comotan internet, konten tidak | Camera), Filter NSFW 2-Zona + Cek Piksel |
|   | senonoh (NSFW), foto tidak relevan, dan puluhan | terkalibrasi, tombol Tolak Spam berpenalti, kuota |
|   | tiket ganda di satu titik. | 3/50m & 6/30m , serta hak Oper Tiket berbatas waktu. |

## Tiga Pilar Ekosistem

## 1. Pilar Transparansi

Setiap laporan memiliki Public SLA terbuka dan rantai hash HMAC-SHA256 anonim yang mustahil diedit diam-diam di database.

## 2. Pilar Aspirasi Terverifikasi

Ketat di pintu masuk (kamera live TKP, bebas NSFW, anti-duplikat) dan partisipatif di pintu keluar (kuorum warga per putaran).

## 3. Pilar Stabilitas & Akuntabilitas

Papan skor terbuka

( integrityScore 0–100 , mulai 80 ) yang

menghargai dinas tepat waktu dan menayangkan rasio OUT_OF_SCOPE &

REJECTED_SPAM .

## BAB 2 Arsitektur Peran, Privasi Data & Alur Autentikasi Multi-Role

Sistem menggunakan gerbang masuk satu pintu ( /login ) berbasis Supabase Auth dengan pemisahan wewenang ketat di level database Prisma dan penjaga rute frontend.

## A. Pembagian 4 Tipe Aktor

- Pengunjung Publik (Tanpa Login): Bebas membuka / , /tiket/:id , dan /rapor . Tidak dapat membuat laporan, mendukung prioritas, atau memvalidasi.

- Warga ( WARGA ): Daftar via email/password atau Google OAuth Supabase; otomatis memperoleh nama samaran acak ( Warga-Delta-402 ) agar email & UUID tidak pernah terekspos ke publik.

- Admin Instansi ( ADMIN_DINAS ): Tidak dapat mendaftar dari form publik. Tersedia melalui:

- Akun Mitra Seed: dishub@laporpak.id , dpu@laporpak.id , dlh@laporpak.id , dan satpolpp@laporpak.id terikat departmentId ( isVerifiedPartner: true ).

- Aktivasi Mitra Baru ( /aktivasi-mitra — Bonus Minggu 4): Memakai Kode Aktivasi Sekali Pakai ( MITRA-PU-2027 ) yang dihanguskan usai dipakai.

- Skor Awal Mitra: Seluruh instansi diinisialisasi pada integrityScore = 80 ( 0–100 ) agar dinamika bonus ( +2 / +1 ) & penalti ( -3 / -5 / -6 ) langsung terukur.

- Sesi Simulasi Juri ( ?jury_token= . ): Diverifikasi terhadap JURY_SECRET_TOKEN server lalu menerbitkan signed session token ( TTL 4 jam ) di sessionStorage + header X-Jury-Token berbanner aktif. Isolasi & Kuota Juri: Menolak 403 mutasi pada isDemoData: false , memblokir /aktivasi-mitra , limit 30 mutasi/10 menit & maks 50 tiket isDemoData: true aktif, otomatis menandai record baru isDemoData: true , dan membebaskan akun demo juri dari kuota 5 aktif / 10 per 24j warga biasa.

## B. Alur Login Pemerintah & C. Tata Kelola Privasi Media

- 1. Petugas login di /login → Supabase mengembalikan JWT → frontend memanggil GET /api/auth/me → router mengarahkan ke /dinas , menyembunyikan /lapor , dan seluruh API dinas dikunci where: { departmentId: req.user.departmentId } + DEL cache Redis.

- 2. Anonimitas & Pemisahan Koordinat: Endpoint publik dilarang mengembalikan userId (UUID), email , deviceFingerprint , maupun IP. Kolom Ticket.location ( geography(Point, 4326) ) menyimpan koordinat GPS presisi khusus server untuk ST_DWithin ( 30/50/75/100m ), sedangkan API publik & watermark hanya memakai publicLat / publicLng ( 4 desimal ~11 m ).

- 3. Sterilisasi Metadata & Private Media: Output kamera WebRTC ( canvas.toBlob('image/webp') ) secara alami sudah 0% EXIF; backend memvalidasi magic bytes ( JPEG / WebP ), dimensi ( ≤1280px ), & ukuran ( ≤450 KB ) lalu menyimpan dengan nama CSPRNG UUIDv4. Foto isNsfwPendingReview: true disimpan di private bucket/prefix (Signed URL TTL 60s ), konten NSFW di-hard-delete,


dan REJECTED_SPAM non-NSFW dikarantina privat 7 hari untuk audit. Viewfinder WebRTC mengingatkan agar tidak memotret wajah atau pelat nomor.

## BAB 3 Siklus Hidup 10 Status Tiket (State Machine Tanpa Jalan Buntu)

Seluruh transisi di frontend, peta, dan backend mengacu mutlak pada 10 status baku berikut:

| No Kode Status & Pin 1 OPEN Pin: Biru 2 OUT_OF_SCOPE Pin: Abu-abu 3 REJECTED_SPAM Pin: Abu Gelap (Hidden) 4 IN_PROGRESS Pin: Kuning 5 OVERDUE Pin: Merah 6 PENDING_VALIDATION Pin: Oranye 7 DISPUTED Pin: Ungu 8 ESCALATED Pin: Merah Tua / Hitam 9 CLOSED Pin: Hijau 10 AUTO_CLOSED Pin: Hijau Muda |   | Syarat Masuk Laporan warga lolos NSFW 2- zona, piksel, geofencing, nonce, & masuk DB. Dinas menandai di luar wewenang 4 dinas Pemda (PLN/ PDAM/BPJN/BBWS/Telkom/ Lainnya) + catatan ( ≥20 karakter). Dinas menekan Tolak Laporan saat OPEN dalam min(24j, 50% SLA awal) syncedAt + alasan ( ≥15 karakter). Petugas menekan Mulai Kerjakan ( OPEN ) atau Proses Perbaikan Ulang ( DISPUTED Jalur A). Lewat slaDeadline IN_PROGRESS Evaluation atomik atau Cron harian cadangan). Petugas unggah foto bukti perbaikan live ( ≤75m ) lolos piksel & NSFW. Bantahan putaran 1 ( disputeCount = 1 ) sah dgn foto live ( ≤100m , akurasi Catat disputedAt . Bantahan putaran 2 ( disputeCount = 2 ) sah dgn foto live ( ≤100m , akurasi Kuorum ( ≥2.0 akun berbeda), atau konfirmasi pelapor jam 48–72 disputeCount == 0 ), atau Berita Acara ESCALATED . Lewat 72 jam tanpa bantahan & tanpa respons pelapor (berlaku juga pada agar tidak deadlock; cek version ). | Timer SLA & Aturan Keluar (Transisi Lanjutan) SLA berjalan sejak syncedAt . Dinas boleh Oper Tiket maks 1× (tanpa penalti) saat OPEN dalam min(24j, 50% SLA awal) ( 12j Darurat) dihitung dari syncedAt + alasan ( ≥15 karakter). Hanya memindahkan departmentId tanpa ubah category , buffer penerima max(Sisa SLA, 12j) . Keluar ke IN_PROGRESS , OVERDUE , OUT_OF_SCOPE , atau REJECTED_SPAM . Status Terminal. Timer berhenti, nol efek ke integrityScore / trustScore . Masuk AuditLog , rasio tayang di /rapor (lencana peringatan bila >25% ). Status Terminal. Hilang dari peta publik, foto non-NSFW dipindah ke private quarantine 7 hari (NSFW di-hard-delete), masuk sejak AuditLog , rasio tayang di /rapor (warning >20% ). Pelapor kena -0.5 (lantai 0.1 pelanggaran ke-1) + cooldown 24 jam. Timer SLA berjalan (Oper Tiket & Tolak Spam nonaktif). Pindah ke PENDING_VALIDATION saat unggah bukti selesai live ( ≤75m ), atau ke OVERDUE saat waktu habis. saat OPEN / Dinas dipotong -3 poin (atau -6 poin jika supportCount ≥ 10 ), (dipicu Lazy maks 1× ( overduePenalized ). Bila now - slaDeadline > slaInitialHours ( >100% telat aktif), set sticky isChronicOverdue = true permanen di /rapor . Petugas tetap wajib unggah bukti live ( ≤75m ). Simpan sisa SLA ke remainingSlaMs , jeda timer, catat validationStartedAt , validationRound + , bobot weightAtVote mulai dari 0 . Fase 1 ( 0–48j ) & Fase 2 ( 48–72j ) berjalan. Keluar ke CLOSED , DISPUTED , ESCALATED , atau AUTO_CLOSED (jam 72, cek version ). SLA jeda maks 24j sejak disputedAt . (A) Perbaikan Ulang → IN_PROGRESS ( isAppealRound = false , ≤50m ). slaDeadline = now + max(0, remainingSlaMs) + 24j ); (B) Maks 1× , unggah foto sudut baru ( ≤75m ) + Ajukan Banding Bukti → PENDING_VALIDATION ( validationRound + , disputeCount tetap 1 , isAppealRound = true ; pembantah putaran 1 dilarang vote/bantah ke-2; penalti -0.5 + 24j aktif hanya bila isAppealRound == true berakhir CLOSED oleh ≥2 warga lain). Anti-Deadlock: Lewat 24j diam → paksa Jalur A deterministik ( reworkStart = disputedAt + 24j ). Penalti permanen -5 integrityScore langsung dipotong. Tutup titik wajib 2 bukti: Berita Acara ( PDF/JPG/PNG ≤5 MB ) + Foto ≤50m ). Live ( ≤75m ) → CLOSED berlabel “Diselesaikan via Berita Acara Eskalasi” (tanpa bantahan ke-3). poin DAN ≥2 Status Terminal. Tepat waktu tanpa OVERDUE / DISPUTED / ESCALATED → dinas +2 ( CLOSED pasca- DISPUTED = 0 ; clamp (khusus [0, 100] ). Pelapor & validator aktif (atau pembantah putaran 1 & 2 pada ESCALATED ) dapat +0.1 trustScore (maks 2.0 ). Status Terminal. Bonus dinas 0 poin (netral) agar perbaikan fiktif di jalan sepi tidak pernah mendapat hadiah; pelapor disputeCount == 1 +0.1 trustScore (maks 2.0 ). Tidak memicu penalti pembantah putaran 1. |
| --- | --- | --- | --- |

## BAB 4 Aturan Main, Rumus Penilaian & Pengamanan

## A. Pintu Masuk Anti-Hoaks, Anti-NSFW, Kalibrasi Piksel & Anti-Duplikat

- Kuota Spasial ( geography(Point, 4326) ) & Kuota Akun: Maksimal 3 laporan aktif kategori sama dalam radius 50m , maksimal 6 laporan aktif lintas seluruh kategori dalam radius 30m (anti category-cycling spam), serta maksimal 5 tiket aktif serentak dan 10 tiket/24


- jam per akun WARGA (dibebaskan khusus sesi X-Jury-Token ). Dicek ulang atomik di transaksi POST /api/tickets ( 409 → Dukung Prioritas).

- Efek Dukung Prioritas: 1 akun WARGA (bukan reporterId sendiri & bukan ADMIN_DINAS ) hanya 1× per tiket di status OPEN / IN_PROGRESS . Tiap kelipatan 10 dukungan memangkas sisa SLA 15% hanya jika sisa SLA >6 jam dengan lantai 6 jam ( now + max(6 jam, sisaSLA × 0.85) ). Begitu supportCount ≥ 10 , penalti OVERDUE terkunci -6 poin (maks -6 meski dukungan ≥20 ).

- Kamera Live, Kalibrasi Canvas & Filter NSFW 2-Zona (Berlaku pada Lapor, Selesai Dinas & Bantahan):

- Blokir Galeri & Kamera Virtual: <input type="file"> diblokir mutlak untuk foto lapangan ( facingMode: "environment" , tolak label OBS / ManyCam / Virtual / Snap Camera ). Pengecualian tunggal: dokumen Berita Acara ( PDF/JPG/PNG ≤5 MB ) pada ESCALATED /dinas .

- Kalibrasi Piksel Canvas ( Asia/Jakarta UTC+7): BT.601 Luminance ( Y = 0.299R + 0.587G + 0.114B , 0–255 ): tolak silau ( Y > 245 ) dan gelap ( Y < 35 normal; longgar Y < 12 jam 18.00–05.30 WIB untuk 3 kategori Darurat + PJU_MATI + SALURAN_TERSUMBAT ). Ketajaman Laplacian ( 256×256 grayscale): tolak < 45 ; bila gagal 2× beruntun, percobaan ke- 3 boleh lolos dengan isLowQualityOverride: true (tampil normal + lencana info, bukan blur sensor NSFW).

- Filter NSFW 2-Zona: nsfwjs di browser (lazy import & berjalan async pasca-jepret agar <2 detik ) + moderasi backend ( >4 detik timeout → fail-safe isNsfwPendingReview: true ). Zona 0.55–0.84 minta jepret ulang tanpa penalti; ≥0.85 /server blokir total + -0.5 trustScore + cooldown 24j .

- Geofencing, Action-Bound Nonce Aman Retry & Offline:

- Geofencing: Poligon daratan Kab. Sidoarjo & Kota Surabaya (+ buffer 500m , GeoJSON ≤50 KB tampil di /lapor ; tolak 422 jika di luar, kecuali GPS Simulator juri).

- Action-Bound Nonce & Urutan SETNX : Untuk MVP, server menerbitkan online nonce ( 15m ) mengikat wajib di backend: (1) cek Idempotency-Key , (2) validasi Zod/geofencing/kuota/NSFW, (3) eksekusi Redis SETNX nonce:jti ( TTL 24j ) sebelum upload & commit DB (kompensasi DEL + cleanup saat 5xx ). Server memvalidasi gpsAccuracy ≤ 50m , magic bytes ( JPEG / WebP ), dimensi ( ≤1280px ), & ukuran ( ≤450 KB ); output WebRTC canvas.toBlob secara native sudah 0% EXIF. { userId, deviceFingerprint, actionType, ticketId?, jti } ( 2 token offline IndexedDB 24j masuk Bonus Minggu 4). Urutan

- Media isNsfwPendingReview: true : Disimpan pada private bucket/prefix (tanpa sharp derivative), tampil blur di UI, dan dibuka lewat Signed URL ( TTL 60 detik ) saat diklik “Tampilkan Gambar”.

## B. Aturan Kuorum Validasi, Hak Suara & C. Keamanan + Panel Juri

- Reputasi trustScore ( 0.0–2.0 ): Mulai 0.5 ; naik 1× ke 1.0 pasca 1 laporan/validasi sah ( violationCount == 0 ); +0.1 saat CLOSED (termasuk pembantah putaran 1 & 2 jalur ESCALATED ) atau AUTO_CLOSED (pelapor); pelanggaran -0.5 + cooldown 24j (pelanggaran pertama akun 0.5 turun ke lantai 0.1 , tidak langsung freeze). Freeze 7 hari aktif mulai violationCount ≥ 2 ( 0.0 ) atau ≥3 pelanggaran/30 hari; pasca-freeze akun 0.0 boleh melapor ( +0.1 saat sah), Sudah Beres terkunci sampai ≥0.5 & Klaim Palsu ≥1.0 . Rate limit >5/jam ( 2× ) → cooldown 24j khusus WARGA .

- Kuorum Ganda & Hak Suara: Wajib ≤100m , akurasi GPS ≤50m , suara final per putaran, memakai snapshot statis weightAtVote : akun). Fase 1 ( 0–48j sejak validationStartedAt ): pelapor dilarang Sudah Beres, boleh Klaim Palsu ( ≥1.0 ). Fase 2 ( 48–72j ): tombol 1-tap bebas radius pelapor hanya muncul bila disputeCount == 0 ( AUTO_CLOSED jam 72 tetap jalan, bonus dinas 0 ). Putaran banding ( isAppealRound == true ): pembantah putaran 1 dilarang vote/bantah ke-2. ADMIN_DINAS dilarang voting. SUM(weightAtVote) ≥ 2.0 DAN ≥ 2 akun & deviceFingerprint berbeda (cukup 2 warga standar atau 4 warga baru, tetap kebal 1

- Rantai Hash Anonim ( HMAC-SHA256 ), Transaksi & Redis: AuditLog menyimpan actorRole , actorDisplayLabel , dan actorPublicRef = HMAC-SHA256(AUDIT_SALT, actorId) (UUID tidak pernah bocor):

## currentHash = HMAC-SHA256(SERVER_SECRET, ticketId || actorPublicRef || action || timestampMs || prevHash)

- Anti-Race & Anti-Sybil: Prisma transaksi SELECT FOR UPDATE + version + UNIQUE(ticketId, validatorId, validationRound) + ( >120 km/jam khusus kedua titik GPS ≤50m ). deviceFingerprint = UNIQUE(ticketId, deviceFingerprint, validationRound) . Redis cache peta ( 45s ) & rapor ( 180s ) + explicit DEL , Impossible Travel SHA-256(clientInstallId + userAgent + screen + hardwareConcurrency) (stabil di Safari/iOS).

- Panel Simulasi Juri ( ?jury_token= . ): 5 alat cepat ( Role Switcher , GPS Simulator , Simulasi Jepret Kamera memakai aset public/samples/ terkalibrasi Y ∈ [50,220] & Laplacian ≥ 80 + auto-nonce, Percepat Waktu +25j/+49j , dan Reset Demo isolasi isDemoData: true + DEL Redis).

## BAB 5 Matriks Kondisi Layar & Edge-Case UI (5 Halaman + 1 Drawer)

Tema visual Civic Tactical with Progressive Depth (terang hangat di / , Field Blueprint di /lapor & /tiket/:id , Deep Command Slate #0F172A di /rapor & panel hash) bersama 2 maskot orisinal Cak Pantau & Mas Sigap.

| Halaman / (Beranda & Peta) /lapor (Buat Laporan) |   | Kondisi Normal (Happy Path) Hybrid Hero ( 60% viewport) Cak Pantau & Mas Sigap + siluet kota, menyambung peta Leaflet & timer SLA. Geser pin (dalam poligon) → cek kuota lolos → WebRTC → jepret → kirim. | Kondisi Ekstrem / Edge-Case & Perilaku UI • Filter Kosong / Lambat: Pose maskot Siaga + “Reset Filter Peta”; skeleton loader + cache Redis terakhir. • Luar Poligon / Kuota Penuh ( 3/3 di 50m atau 6/6 di 30m , atau 409 sync): Tampilkan garis poligon / daftar tiket aktif + Dukung Prioritas. • Piksel / NSFW: Zona 0.55–0.84 atau blur ke-1/2 jepret ulang (blur ke-3 lanjut via isLowQualityOverride ); ≥0.85 blokir -0.5 & cooldown . • Kamera Virtual / Offline / Limit 5 Aktif: Blokir OBS/Virtual (juri tampil Simulasi Kamera); simpan IndexedDB 24j ; kunci bila cooldown/freeze/limit akun. |
| --- | --- | --- | --- |


| Halaman | Kondisi Normal (Happy Path) |   |   |   | Kondisi Ekstrem / Edge-Case & Perilaku UI |   |
| --- | --- | --- | --- | --- | --- | --- |
| /tiket/:id | Foto Before–After, bar kuorum ( x/2.0 | & | • | GPS >100m | / Akurasi | >50m : Tombol validasi nonaktif dengan jarak |
| (Detail & Uji Publik) | validator), tombol validasi, dan panel |   |   | & akurasi aktual (kecuali pelapor jam |   | 48–72 untuk Sudah Beres). |
|   | hash HMAC-SHA256 |   | • | Pelapor 0–48j | vs | 48–72j : Jam 0–48 : banner warga sekitar |
|   | ( actorDisplayLabel ). |   |   | (Klaim Palsu aktif |   | ≤100m ). Jam 48–72 : 1-tap bebas radius hanya |
|   |   |   |   | jika | disputeCount == 0 . |   |
|   |   |   | • |   | isNsfwPendingReview | vs isLowQualityOverride : NSFW pending |
|   |   |   |   | tampil blur + tombol “Tampilkan Gambar” (Signed URL |   | 60s ); |
|   |   |   |   | kualitas rendah tampil normal + lencana info. |   |   |
|   |   |   | • | Bukan | OPEN / IN_PROGRESS | atau Pelapor Sendiri: Dukung |
|   |   |   |   | Prioritas nonaktif; tooltip pembantah putaran 1 di banding & |   |   |
|   |   |   |   | trustScore ≥ 1.0 ; toast |   | 409 auto-refresh. |
| /dinas | Antrean urut OVERDUE | & SLA tersingkat; | • | Warga / Batas Waktu: Warga redirect ke |   | / ; Oper & Tolak Spam |
| (Meja Kerja Dinas) | aksi Kerjakan, Oper, Tolak Spam, Di |   |   | terkunci jika bukan | OPEN | atau lewat min(24j, 50% SLA) sejak |
|   | Luar Wewenang, Selesai. |   |   | syncedAt . |   |   |
|   |   |   | • | Modal Wajib / | DISPUTED : | OUT_OF_SCOPE (instansi baku + ≥20 |
|   |   |   |   | kar) & | REJECTED_SPAM | ( ≥15 kar); DISPUTED tampilkan timer 24j |
|   |   |   |   | respons & sembunyikan Banding usai |   | 1× . |
|   |   |   | • | GPS >75m | / Akurasi | >50m / ESCALATED : Kunci tombol selesai; |
|   |   |   |   | ESCALATED | wajib Berita Acara ( ≤5 MB ) + Foto Live ( ≤75m ). |   |
| /rapor | Tema Deep Command Slate, skor 4 |   | • | Filter Kategori Nihil: Grafik menampilkan angka |   | 0 bersih tanpa |
| (Rapor & Heatmap) | dinas ( 0–100 ), SLA, OVERDUE / |   |   | error dan peta menampilkan “Belum ada titik kerusakan di |   |   |
|   | ESCALATED , rasio isChronicOverdue , |   |   | kategori ini”. |   |   |
|   | OUT_OF_SCOPE ( >25% ) & |   |   |   |   |   |
|   | REJECTED_SPAM ( >20% ). |   |   |   |   |   |
| Profile Drawer | aliasName , bar | trustScore , cooldown/ | • | Antrean Offline: Tombol “Sinkronkan Sekarang”, jumlah foto |   |   |
|   | freeze, riwayat, & antrean offline. |   |   | tertunda di IndexedDB, dan sisa masa berlaku draf |   | 24 jam . |

## BAB 6 User Stories (Urut Sesuai Ketergantungan Teknis)

## Tahap 1 — Fondasi Database, Auth & Keamanan Inti (`US-001` s.d. `US-004`)

- US-001 (Prisma + PostGIS geography & Seed): 5 model inti ( Department , User , Ticket , TicketValidation , AuditLog ) + TicketSupport , 10 status, 8 kategori, @default(80) skor dinas, version , validationRound , isAppealRound , weightAtVote , remainingSlaMs , validationStartedAt , disputedAt , isChronicOverdue , overduePenalized , isDemoData , isNsfwPendingReview , isLowQualityOverride , location ( geography(Point, 4326) ) terpisah dari publicLat / publicLng , constraint unik ganda, dan seed.ts ( 25–30 tiket 10 status + tiket jam 50; akun demo Warga Pelapor maks 2 tiket aktif).

- US-002 (Supabase Auth 1 Pintu, Privasi & Juri Guard): Login/OAuth ( WARGA + alias acak), 4 akun dinas, /aktivasi-mitra (bonus), departmentId isolation, sanitasi UUID publik, dan signed X-Jury-Token ( 4j , 403 data riil, 30/10m , bypass limit 5 tiket aktif khusus sesi juri).

- US-003 (AuditLog HMAC-SHA256 Anonim): Catat actorPublicRef , actorRole , & actorDisplayLabel pada tiap transisi dan sediakan GET /api/tickets/:id/audit-verify .

- US-004 (Lazy Evaluation Utama, Cron Cadangan & Redis): Lazy Eval atomik ( OVERDUE , sticky isChronicOverdue , auto-rework DISPUTED >24j , AUTO_CLOSED >72j ) + Cron harian; cache peta ( 45s )/rapor ( 180s ) + DEL ; nonce SETNX aman retry; rate limit ( 5/j & 10/24j ); Impossible Travel ( ≤50m ); & deviceFingerprint .

## Tahap 2 & Tahap 3 — Mesin API (`US-005`–`US-007`) & Antarmuka (`US-008`–`US-015`)

- US-005 (Radius geography , Create Atomik & Support): check-radius ( 3/50m & 6/30m ), transaksi create ( Idempotency-Key → validasi → SETNX → upload → commit, rollback aman), support (bukan pelapor sendiri, 15% floor 6j , penalti -6 ).

- US-006 (8 Aksi Kerja Dinas): process , transfer ( syncedAt , 1× , buffer ≥12j ), out-of-scope , reject-spam ( syncedAt , hard- delete Storage + -0.5 ), resolve ( ≤75m , remainingSlaMs ), reprocess-disputed ( isAppealRound = false ), counter-dispute ( 1× , isAppealRound = true ), dan resolve-escalated ( ≤5 MB + ≤75m ).

- US-007 (Validasi ≤100m Anti-Race): SELECT FOR UPDATE + version , kuorum ganda weightAtVote , pelapor jam 0–48 boleh bantah & jam 48–72 1-tap bebas radius khusus disputeCount == 0 , larangan pembantah putaran 1 saat isAppealRound == true , dan vonis komunitas -0.5 hanya saat isAppealRound == true berakhir CLOSED .

- US-008 s.d. US-015 (UI, Kamera WebRTC, Panel Juri & 5 Layar): Design System + 2 maskot ( US-008 ); kamera WebRTC + kalibrasi BT.601/Laplacian + Action-Bound Nonce + React.lazy() / import('nsfwjs') + private Signed URL 60s + IndexedDB ( US-009 ); Panel Juri 5 alat dgn foto sampel terkalibrasi ( US-010 ); 5 halaman inti + Profile Drawer ( US-011 – US-015 ).


## BAB 7 Matriks Prioritas Pengerjaan (MVP Wajib Jadi vs Bonus)

| Prioritas | Daftar Fitur & Modul |   |   |   | Target Selesai |
| --- | --- | --- | --- | --- | --- |
| WAJIB JADI | • Skema Prisma + PostGIS | geography | ( isAppealRound , | remainingSlaMs , | Minggu 1 – Minggu 3 |
| MVP Inti Lomba | weightAtVote , |   | version , 8 kat, 10 status) + 25–30 seed |   | (Feature Freeze: |
|   | • Auth 1 pintu Supabase (Warga + 4 Dinas) & Alias Publik + 5 Halaman Utama + |   |   |   | 12 Desember 2026) |
|   | Profile Drawer |   |   |   |   |
|   | • Peta Leaflet + geofencing GeoJSON + cek kuota atomik ( 3/50m |   |   | & 6/30m ) + |   |
|   | Dukung Prioritas (floor | 6j ) |   |   |   |
|   | • WebRTC Live Camera + BT.601/Laplacian + Lazy |   | nsfwjs | 2-zona + Action- |   |
|   | Bound Nonce + | REJECTED_SPAM | hard-delete |   |   |
|   | • Alur penuh 10 status ( DISPUTED | 24j + | isAppealRound , | ESCALATED + Berita |   |
|   | Acara PDF, kuorum ganda) |   |   |   |   |
|   | • Rantai hash HMAC-SHA256 | anonim, Lazy Evaluation SLA & explicit Redis |   | DEL |   |
|   | + Panel Juri 5 alat + 2 Maskot pose standar |   |   |   |   |
| BONUS | • 5 variasi ekspresi pose dinamis tiap maskot · Halaman |   |   | /aktivasi-mitra | Minggu 4 |
| Jika MVP 100% Stabil | (kode undangan dinas baru) |   |   |   | (13–16 Des 2026, |
|   | • Heatmap gradien kompleks di | /rapor | (MVP cukup klaster marker) · |   | paralel Video Demo) |
|   |   | Sinkronisasi otomatis penuh IndexedDB · Email/push jam ke-48 |   |   |   |

## BAB 8 Batasan Ruang Lingkup (Non-Goals) & Metrik Keberhasilan

## Yang Tidak Dibangun (Out of Scope)

- Tidak terhubung ke API internal Pemda asli (DB mandiri & seed Sidoarjo–Surabaya).

- Tidak membangun APK/IPA native maupun ruang obrolan (chat) bebas.

- Tidak menyediakan tombol Penurunan Kategori/SLA oleh dinas ( JALAN_AMBLES 24j → JALAN_BERLUBANG 168j) agar oknum tidak bisa menyabotase tenggat darurat; klaim darurat palsu ditolak via REJECTED_SPAM ( ≤12j ).

## Metrik Keberhasilan Kompetisi

- Kinerja & Kestabilan (Bobot 30%): Seluruh halaman & peta <2 detik di tautan Vercel publik (Vercel Auth nonaktif) tanpa error konsol maupun gagal konkurensi.

- Kelancaran Uji Juri: Siklus penuh tuntas <3 menit lewat Panel Juri meski dari PC tanpa webcam; URL lengkap beserta ?jury_token= . wajib di baris teratas README.md dan awal Video Demo.

- Kepatuhan Rulebook: 1 GitHub Monorepo, UI 100% custom, maskot orisinal, dan video demo Drive (viewer) <18 Desember 2026, 23.59 WIB .

## BAB 9 Checklist Penguncian 32 Edge-Case & Anti-Eksploitasi (QA Master Final)

Tabel berikut merangkum seluruh 32 celah logika, keamanan, privasi & performa ( #1–#18 v3.2, #19–#26 v3.3, #27–#32 v3.4 Final) yang sudah menyatu permanen ke Bab 2–8:

| No Level #1 KRITIS #2 KRITIS #3 KRITIS #4 KRITIS #5 TINGGI #6 TINGGI #7 TINGGI #8 TINGGI #9 MENENGAH |   | Celah yang Ditemukan Konflik Tolak Bantahan hukum warga sepihak / tolak tanpa batas. Tabrakan UNIQUE terhitung atau blokir validasi ulang. SLA Rework Negatif & Double Bekas -48j + 24j tetap negatif. False Positive Foto: Lumpur kena blokir, file spam tersisa. Stale Redis, ?jury_token Reset Demo : Cache macet; hapus warga. Hak Pelapor Utama ( 0–48j Ambiguitas bantah & syarat radius. Eksploitasi Oper , REJECTED_SPAM : Mangkir saat mepet SLA. Rumus Skor, Floor 6j , Kuorum Pemulihan: Celah poin & deadlock Kontradiksi <input type="file"> Berita Acara: Blokir file memutus PDF eskalasi. | & Loop: Oknum Putaran ke-2: Suara lama OVERDUE : nsfwjs , Bypass & Bocor Hilang & TRUNCATE vs 48–72j ): OUT_OF_SCOPE & 2.0 & 0.0 . vs |   | Solusi Terkunci di Spesifikasi v3.4 (Bab 2–8) Maks 1× ( isAppealRound = true ), disputeCount tetap 1 , penalti -0.5 + 24j aktif hanya bila putaran banding CLOSED oleh ≥2 warga lain. Tambah validationRound + , ubah constraint ke UNIQUE(ticketId, validatorId, validationRound) + deviceFingerprint , reset kuorum ke 0 . Simpan remainingSlaMs ; rework = max(0, remainingSlaMs) + 24j ; penalti OVERDUE maks 1× ( overduePenalized ); Lazy Evaluation atomik. 2 Zona ( 0.55–0.84 ulang; ≥0.85 /server blokir -0.5 + 24j ) di 3 titik + timeout >4d → isNsfwPendingReview ; NSFW/ REJECTED_SPAM hard-delete. Wajib DEL Redis tiap mutasi/reset; simpan token di sessionStorage + X-Jury-Token ; Reset Demo hanya reset isDemoData: true & 4 dinas. Boleh Klaim Palsu sejak jam 0 ( ≤100m , ≥1.0 ); jam 48–72 1-tap bebas radius khusus disputeCount == 0 . Oper & REJECTED_SPAM hanya saat OPEN dalam min(24j, 50% SLA) sejak syncedAt ; buffer ≥12j ; wajib alasan/ rujukan & tampil di /rapor . Clamp [0, 100] ; AUTO_CLOSED = 0 (netral); kuorum ≥2.0 DAN ≥2 akun; ESCALATED +0.1 ke pelapor + pembantah 1 & 2; pelanggaran ke-1 akun 0.5 turun ke 0.1 (freeze 7h mulai pelanggaran ke-2). Blokir total foto lapangan, pengecualian tunggal dokumen Berita Acara ESCALATED ( PDF/JPG/PNG ≤5 MB ) + foto live ≤75m . |
| --- | --- | --- | --- | --- | --- |


| No | Level | Celah yang Ditemukan |   |   | Solusi Terkunci di Spesifikasi v3.4 (Bab 2–8) |   |   |
| --- | --- | --- | --- | --- | --- | --- | --- |
| #10 | MENENGAH | Race Kuota | 50m | & Draf Offline Basi: | Re-cek atomik di transaksi | POST /api/tickets | ( 409 → Dukung |
|   |   | Tembus 4 tiket; draf tua potong SLA. |   |   | Prioritas); offline SLA dari | syncedAt , kedaluwarsa | 24j . |
| #11 | MENENGAH | Timezone UTC, Wi-Fi Sama & False |   |   | Evaluasi malam | Asia/Jakarta ; Sybil via | deviceFingerprint ; |
|   |   | Impossible Travel: Meleset 7j; Wi-Fi laptop ke |   |   | Impossible Travel ( >120 km/j ) hanya bila kedua titik berakurasi |   |   |
|   |   | HP. |   |   | ≤50m . |   |   |
| #12 | MENENGAH | Belum Ada Pemetaan Tunggal Kategori: |   |   | Dikunci 1-ke-1 ke 8 kategori baku di Lampiran A sebagai satu- |   |   |
|   |   | Rawan beda enum FE vs BE. |   |   | satunya acuan Prisma, UI, dinas default, SLA, & kelonggaran |   |   |
|   |   |   |   |   | malam. |   |   |
| #13 | KRITIS | Penyalahgunaan |   | ?jury_token= & Self- | Signed token 4j , 403 | untuk | isDemoData: false , dan semua |
|   |   | Block Demo: Ubah data riil / blokir tiket baru. |   |   | record baru sesi juri otomatis | isDemoData: true . |   |
| #14 | KRITIS | Deadlock | DISPUTED | & Bonus Waktu Lazy | Batas respons 24j sejak | disputedAt ; bila lewat paksa Jalur A |   |
|   |   | Eval: Dinas mendiamkan tiket selamanya. |   |   | deterministik ( reworkStart = disputedAt + 24j , bukan |   | now ). |
| #15 | KRITIS | Bypass Kamera, EXIF & Nonce Offline: |   |   | MVP pakai Online Action-Bound Nonce ( 15m ; |   | 2 token offline |
|   |   | curl |   | bypass / beban offline MVP. | masuk Bonus), canvas.toBlob |   | bebas EXIF + cek magic bytes & |
|   |   |   |   |   | ukuran di server. |   |   |
| #16 | TINGGI | Konfirmasi Sepihak & Sabotase Putaran |   |   | 1-tap pelapor jam 48–72 | hanya bila | disputeCount == 0 |
|   |   | Banding: Pemfitnah langsung picu |   |   | ( AUTO_CLOSED jam 72 | tetap jalan 0 | bonus); pembantah 1 dilarang |
|   |   | ESCALATED . |   |   | vote/bantah di Jalur B. |   |   |
| #17 | TINGGI | Skor Awal | 100 | & False Flag | Skor awal 80 ; | isChronicOverdue = true | hanya saat OVERDUE |
|   |   | isChronicOverdue : Bonus |   | +2 tak terlihat; | melampaui | now - slaDeadline > slaInitialHours . |   |
|   |   | salah flag Darurat. |   |   |   |   |   |
| #18 | MENENGAH | Kuorum Retroaktif, Geofencing, |   |   | Simpan | weightAtVote ; poligon Sidoarjo–Surabaya (+ 500m , |   |
|   |   | Fingerprint & |   | nsfwjs : Skor berubah / | GeoJSON ≤50 KB ); | deviceFingerprint | ringan aman Safari; Vite |
|   |   | halaman lambat. |   |   | React.lazy() / import() | async pasca-jepret. |   |
| #19 | KRITIS | Hilang Sisa SLA Saat Pause & Reset |   |   | Tambah remainingSlaMs & | validationStartedAt ; |   |
|   |   | isChronicOverdue |   | (v3.3): Flag hilang saat | isChronicOverdue |   | dikunci sebagai sticky boolean permanen. |
|   |   | pending. |   |   |   |   |   |
| #20 | KRITIS | Salah Penalti Pembantah pada Jalur A |   |   | Tambah isAppealRound | pada | Ticket ; penalti pembantah putaran |
|   |   | Rework (v3.3): Putaran 2 Jalur A memotong |   |   | 1 hanya bila | isAppealRound == true berakhir | CLOSED oleh ≥2 |
|   |   | -0.5 . |   |   | warga lain. |   |   |
| #21 | KRITIS | Nonce Lintas Aksi/Tiket & Spoofing |   |   | Nonce jti mengikat |   |   |
|   |   | Akurasi GPS (v3.3): Nonce dipakai ulang |   |   | { userId, deviceFingerprint, actionType, ticketId } ; server |   |   |
|   |   | lintas aksi. |   |   | wajib tolak bila | gpsAccuracy > 50m . |   |
| #22 | TINGGI | Kebocoran UUID di |   | AuditLog & | Rantai HMAC pakai |   |   |
|   |   | Enumerasi File (v3.3): UUID warga bocor ke |   |   | actorPublicRef = HMAC-SHA256(AUDIT_SALT, actorId) |   | dan |
|   |   | publik. |   |   | nama berkas Storage memakai CSPRNG UUIDv4. |   |   |
| #23 | TINGGI | Flooding Simulasi via Token Juri Publik |   |   | Limit sesi juri | 30 mutasi/10 menit , maks 50 | tiket |
|   |   | (v3.3): Token | README.md | disalahgunakan. | isDemoData: true | aktif, serta blokir akses | /aktivasi-mitra . |
| #24 | MENENGAH | Category-Cycling Spam & Penumpukan |   |   | Kuota global maks 6 | tiket aktif lintas kategori radius | 30m , plus |
|   |   | Tiket (v3.3): 24 tiket di 1 titik lintas 8 kategori. |   |   | maks 5 tiket aktif serentak & | 10/24j per akun | WARGA . |
| #25 | MENENGAH | Ambang Piksel, Rasio |   | OUT_OF_SCOPE / | BT.601 ( Y ≥ 35 , malam | ≥ 12 | untuk 3 Darurat + PJU + Saluran, |
|   |   | REJECTED_SPAM |   | & Self-Support: Angka | ≤ 245 ) & Laplacian | ≥ 45 ; warning | /rapor OUT_OF_SCOPE > 25% |
|   |   | kabur & dukung sendiri. |   |   | & REJECTED_SPAM > 20% ; blokir self-support. |   |   |
| #26 | KRITIS | Bug Derajat vs Meter PostGIS |   | ST_DWithin | Seluruh kolom koordinat spasial wajib bertipe |   |   |
|   |   | (v3.3): | geometry | menghitung derajat. | geography(Point, 4326) | agar jarak selalu dalam satuan meter. |   |
| #27 | KRITIS | Acuan | createdAt | Offline & Pergeseran | Batas Oper / REJECTED_SPAM | dihitung dari | syncedAt ; pisahkan |
|   |   | Pembulatan GPS (v3.4): Draf offline makan |   |   | Ticket.location | (presisi server) vs | publicLat / publicLng ( 4 |
|   |   | jendela dinas. |   |   | desimal publik). |   |   |
| #28 | KRITIS | Self-Lock Demo Juri oleh Limit |   | 5 Tiket | Akun seed Warga Pelapor | maks 2 tiket aktif; sesi | X-Jury-Token |
|   |   | Aktif (v3.4): Akun demo gagal buat laporan. |   |   | membebaskan limit 5/10 | per akun & Simulasi Kamera auto- |   |
|   |   |   |   |   | nonce. |   |   |
| #29 | KRITIS | Nonce Hangus Sebelum Validasi / Retry |   |   | Urutan wajib: cek | Idempotency-Key | → validasi Zod/kuota/NSFW |
|   |   | Jaringan (v3.4): Retry |   | Idempotency-Key | → SETNX nonce:jti | sebelum upload/commit, kompensasi | DEL + |
|   |   | gagal. |   |   | cleanup saat 5xx . |   |   |
| #30 | TINGGI | Beban | blurred derivative | Vercel & File | Foto isNsfwPendingReview: true |   | disimpan di private bucket/ |
|   |   | Yatim (v3.4): | sharp | berat & rawan OOM. | prefix, tampil blur di UI, dibuka via Signed URL |   | 60s saat diklik. |
| #31 | TINGGI | Sinkronisasi | US-007 , Label | AuditLog & | Kunci disputeCount == 0 | di US-007 ; tambah | actorRole & |
|   |   | Lampiran B (v3.4): Syarat & endpoint |   |   | actorDisplayLabel pada | AuditLog ; lengkapi seluruh 17 endpoint |   |
|   |   | tertinggal. |   |   | di Lampiran B. |   |   |


| No | Level | Celah yang Ditemukan | Solusi Terkunci di Spesifikasi v3.4 (Bab 2–8) |   |   |
| --- | --- | --- | --- | --- | --- |
| #32 | MENENGAH | Salah Sensor Blur Foto Buram & Sampel | Pisahkan | isNsfwPendingReview | (blur sensor) vs |
|   |   | Juri (v3.4): Foto lubang buram disensor | isLowQualityOverride |   | (tampil normal + lencana info); sampel |
|   |   | NSFW. | public/samples/ | lolos | Y ∈ [50,220] & ≥80 . |

## LAMPIRAN A Tabel Master Kategori Baku (Single Source of Truth FE & BE)

| Kode Enum (category) | Label Tampilan UI | Instansi Default | Tier & SLA | Kelonggaran Malam (Y | ≥ |
| --- | --- | --- | --- | --- | --- |
|   |   |   |   | 12) |   |
| JALAN_AMBLES | Jalan Ambles Parah | Dinas PU Bina Marga | DARURAT · 24j | Ya (18.00–05.30 WIB) |   |
| KABEL_MENJUNTAI | Kabel / Tiang Bahaya | Dishub | DARURAT · 24j | Ya (18.00–05.30 WIB) |   |
| POHON_TUMBANG | Pohon Tumbang / Halang | DLH | DARURAT · 24j | Ya (18.00–05.30 WIB) |   |
|   | Jalan |   |   |   |   |
| PJU_MATI | Lampu PJU Mati | Dishub | MENENGAH · 72j | Ya (18.00–05.30 WIB) |   |
| SAMPAH_LIAR | Tumpukan Sampah Liar | DLH | MENENGAH · 72j | Tidak ( Y ≥ 35 ) |   |
| SALURAN_TERSUMBAT | Saluran Air / Drainase | Dinas PU Bina Marga | MENENGAH · 72j | Ya (18.00–05.30 WIB) |   |
|   | Tersumbat |   |   |   |   |
| REKLAME_LIAR | Reklame / Bangunan Liar | Satpol PP | MENENGAH · 72j | Tidak ( Y ≥ 35 ) |   |
|   | Bahaya |   |   |   |   |
| JALAN_BERLUBANG | Jalan / Aspal Berlubang | Dinas PU Bina Marga | STANDAR · 168j | Tidak ( Y ≥ 35 ) |   |

## LAMPIRAN B Referensi Lengkap 17 Kontrak Endpoint API (Acuan FE & BE)

- 1. Kesehatan, Auth, Sesi Juri & Akses Publik

- POST /api/capture-nonce — Online Action-Bound Nonce 15m ( 2 token offline masuk Bonus).

- GET /api/health — Cek status API, DB & Redis.

- GET /api/auth/me — Profil ter-sanitasi (tanpa UUID/email publik).

- GET /api/tickets/check-radius — Poligon geofencing + kuota 3/50m & 6/30m .

- POST /api/jury/session — Verifikasi jury_token → signed token 4j .

- POST /api/tickets — Buat laporan atomik ( Idempotency-Key → validasi → SETNX → cek magic bytes & upload → commit).

- POST /api/jury/tickets/:id/simulate-time — Geser waktu +25j/+49j .

- POST /api/jury/reset — Reset isDemoData: true + DEL Redis.

- POST /api/tickets/:id/support — Dukungan +1 (bukan pelapor, 15% floor 6j , penalti -6 ).

- GET /api/tickets — Pin publik ( TTL 45s , publicLat / publicLng ).

- POST /api/tickets/:id/validate — Sudah Beres / Klaim Palsu ( SELECT FOR UPDATE + version ).

- GET /api/tickets/:id — Detail, kuorum & UI action flags.

- GET /api/dinas/tickets — Antrean terisolasi departmentId .

- GET /api/tickets/:id/media-signed-url — Signed URL 60s NSFW pending.

- POST /api/tickets/:id/{process | transfer | out-of- scope | reject-spam | resolve | reprocess-disputed | counter-dispute | resolve-escalated}

- GET /api/tickets/:id/audit-verify — Verifikasi rantai HMAC-SHA256 .

Guard departmentId , version , DEL Redis & AuditLog .

- GET /api/rapor — Papan skor 4 dinas ( TTL 180s ) & peta panas.

- 2. Kamera, Pelaporan Warga & Kerja Dinas

—
