import crypto from "node:crypto";

export const STATUS_DICTIONARY = {
  OPEN: {
    code: "OPEN",
    label: "Laporan Baru Masuk",
    pinColor: "Biru",
    hex: "#2563EB",
    ruleSummary: "Timer SLA jalan; maksimal 24 jam pertama untuk oper tiket jika salah dinas.",
  },
  IN_PROGRESS: {
    code: "IN_PROGRESS",
    label: "Lagi Dikerjain Petugas",
    pinColor: "Kuning",
    hex: "#D97706",
    ruleSummary: "Admin dinas menangani tiket; timer SLA tetap berjalan.",
  },
  OVERDUE: {
    code: "OVERDUE",
    label: "Molor Tenggat SLA",
    pinColor: "Merah",
    hex: "#DC2626",
    ruleSummary: "Melewati batas sla_deadline saat OPEN atau IN_PROGRESS; tercatat merah di rapor dinas.",
  },
  PENDING_VALIDATION: {
    code: "PENDING_VALIDATION",
    label: "Masa Uji Publik 48 Jam",
    pinColor: "Oranye",
    hex: "#EA580C",
    ruleSummary: "Petugas unggah bukti radius <= 50m; SLA berhenti, mulai uji publik 48 jam.",
  },
  DISPUTED: {
    code: "DISPUTED",
    label: "Klaim Selesai Dibantah Warga",
    pinColor: "Ungu",
    hex: "#7C3AED",
    ruleSummary: "Warga radius <= 100m mengirim bukti masih rusak; kembali ke antrean dinas (maks 2x).",
  },
  ESCALATED: {
    code: "ESCALATED",
    label: "Eskalasi Pelanggaran",
    pinColor: "Hitam / Merah Tua",
    hex: "#7F1D1D",
    ruleSummary: "Bantahan valid ke-2; siklus sengketa diputus dan memotong skor integritas dinas.",
  },
  CLOSED: {
    code: "CLOSED",
    label: "Selesai Terverifikasi",
    pinColor: "Hijau",
    hex: "#16A34A",
    ruleSummary: "Terkumpul kuorum 3 konfirmasi 1-tap warga atau konfirmasi pelapor utama setelah 48 jam.",
  },
};

export const CATEGORIES = [
  {
    id: "ROAD_DAMAGE",
    label: "Jalan Berlubang & Trotoar",
    defaultAgencyId: "DINAS_PU",
    slaHours: 48,
    dangerWeight: 3,
  },
  {
    id: "STREET_LIGHT",
    label: "Lampu PJU Mati & Rambu",
    defaultAgencyId: "DISHUB_PJU",
    slaHours: 24,
    dangerWeight: 3,
  },
  {
    id: "DRAINAGE_CLOG",
    label: "Saluran Tersumbat & Banjir",
    defaultAgencyId: "DINAS_SDA",
    slaHours: 36,
    dangerWeight: 2,
  },
  {
    id: "ILLEGAL_WASTE",
    label: "Tumpukan Sampah Liar",
    defaultAgencyId: "DINAS_DLH",
    slaHours: 24,
    dangerWeight: 2,
  },
];

const INITIAL_AGENCIES = [
  {
    id: "DINAS_PU",
    name: "Dinas PU Bina Marga",
    shortName: "Dinas PU",
    jurisdiction: "Jalan Raya, Jembatan, & Trotoar Kota",
    baseIntegrityScore: 92,
    penaltyPoints: 0,
    transfersOut: 0,
  },
  {
    id: "DISHUB_PJU",
    name: "Dishub Penerangan Jalan Umum",
    shortName: "Dishub PJU",
    jurisdiction: "Lampu Penerangan Jalan, Rambu, & Marka",
    baseIntegrityScore: 95,
    penaltyPoints: 0,
    transfersOut: 0,
  },
  {
    id: "DINAS_SDA",
    name: "Dinas Sumber Daya Air & Drainase",
    shortName: "Dinas SDA",
    jurisdiction: "Gorong-gorong, Drainase, & Tanggul",
    baseIntegrityScore: 89,
    penaltyPoints: 0,
    transfersOut: 0,
  },
  {
    id: "DINAS_DLH",
    name: "Dinas Lingkungan Hidup & Kebersihan",
    shortName: "Dinas DLH",
    jurisdiction: "Sampah Liar, TPS, & Taman Publik",
    baseIntegrityScore: 91,
    penaltyPoints: 0,
    transfersOut: 0,
  },
];

const INITIAL_PROFILES = [
  {
    id: "CITIZEN_1",
    pseudonym: "Warga#1042",
    role: "CITIZEN",
    personaLabel: "Warga Pelapor (Pelapor Utama)",
    trustScore: 88,
    cooldownUntilMs: 0,
    reportsCreated: 3,
    validationsDone: 5,
    disputesSubmitted: 1,
  },
  {
    id: "CITIZEN_2",
    pseudonym: "Warga#2091",
    role: "CITIZEN",
    personaLabel: "Warga Sekitar #1 (Validator)",
    trustScore: 92,
    cooldownUntilMs: 0,
    reportsCreated: 2,
    validationsDone: 9,
    disputesSubmitted: 0,
  },
  {
    id: "CITIZEN_3",
    pseudonym: "Warga#3110",
    role: "CITIZEN",
    personaLabel: "Warga Sekitar #2 (Validator)",
    trustScore: 85,
    cooldownUntilMs: 0,
    reportsCreated: 1,
    validationsDone: 7,
    disputesSubmitted: 1,
  },
  {
    id: "CITIZEN_4",
    pseudonym: "Warga#4008",
    role: "CITIZEN",
    personaLabel: "Warga Sekitar #3 (Validator)",
    trustScore: 90,
    cooldownUntilMs: 0,
    reportsCreated: 1,
    validationsDone: 6,
    disputesSubmitted: 0,
  },
  {
    id: "ADMIN_PU",
    pseudonym: "Petugas#PU-01",
    role: "ADMIN_DINAS",
    agencyId: "DINAS_PU",
    personaLabel: "Admin Dinas PU Bina Marga",
    trustScore: 100,
    cooldownUntilMs: 0,
    reportsCreated: 0,
    validationsDone: 0,
    disputesSubmitted: 0,
  },
  {
    id: "ADMIN_DISHUB",
    pseudonym: "Petugas#HB-02",
    role: "ADMIN_DINAS",
    agencyId: "DISHUB_PJU",
    personaLabel: "Admin Dishub Penerangan Jalan",
    trustScore: 100,
    cooldownUntilMs: 0,
    reportsCreated: 0,
    validationsDone: 0,
    disputesSubmitted: 0,
  },
  {
    id: "ADMIN_SDA",
    pseudonym: "Petugas#SD-03",
    role: "ADMIN_DINAS",
    agencyId: "DINAS_SDA",
    personaLabel: "Admin Dinas SDA & Drainase",
    trustScore: 100,
    cooldownUntilMs: 0,
    reportsCreated: 0,
    validationsDone: 0,
    disputesSubmitted: 0,
  },
  {
    id: "ADMIN_DLH",
    pseudonym: "Petugas#LH-04",
    role: "ADMIN_DINAS",
    agencyId: "DINAS_DLH",
    personaLabel: "Admin Dinas Lingkungan Hidup",
    trustScore: 100,
    cooldownUntilMs: 0,
    reportsCreated: 0,
    validationsDone: 0,
    disputesSubmitted: 0,
  },
];

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function computeAuditHash(prevHash, entryPayload) {
  return crypto
    .createHash("sha256")
    .update(`${prevHash}|${JSON.stringify(entryPayload)}`)
    .digest("hex")
    .slice(0, 16);
}

export function makeStampedSvgDataUrl({
  title,
  subtitle,
  lat,
  lng,
  timestampIso,
  accentHex = "#1E293B",
  bgHex = "#0F172A",
  mode = "BEFORE",
}) {
  const safeTitle = String(title || "Bukti Lapangan").replace(/[<>&"]/g, "");
  const safeSub = String(subtitle || "").replace(/[<>&"]/g, "");
  const coordText = `GPS ${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
  const timeText = String(timestampIso || new Date().toISOString())
    .replace("T", " ")
    .slice(0, 19);

  const illustration =
    mode === "AFTER"
      ? `<rect x="70" y="95" width="500" height="195" rx="14" fill="#064E3B" stroke="#10B981" stroke-width="3"/>
         <path d="M120 220 L520 220" stroke="#34D399" stroke-width="8" stroke-dasharray="18 10"/>
         <circle cx="320" cy="175" r="36" fill="#10B981" opacity="0.25"/>
         <path d="M302 175 L315 188 L342 160" stroke="#A7F3D0" stroke-width="6" fill="none" stroke-linecap="round"/>`
      : mode === "DISPUTE"
      ? `<rect x="70" y="95" width="500" height="195" rx="14" fill="#4C1D95" stroke="#A855F7" stroke-width="3"/>
         <ellipse cx="320" cy="210" rx="115" ry="38" fill="#1E1B4B" stroke="#F43F5E" stroke-width="4"/>
         <path d="M250 145 L390 250 M390 145 L250 250" stroke="#FB7185" stroke-width="5"/>`
      : `<rect x="70" y="95" width="500" height="195" rx="14" fill="#1E293B" stroke="${accentHex}" stroke-width="3"/>
         <ellipse cx="315" cy="215" rx="110" ry="36" fill="#090D16" stroke="#F59E0B" stroke-width="3" stroke-dasharray="8 6"/>
         <path d="M150 250 L490 250" stroke="#64748B" stroke-width="4"/>`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" viewBox="0 0 640 400">
    <rect width="640" height="400" fill="${bgHex}"/>
    <rect x="16" y="16" width="608" height="368" rx="16" fill="none" stroke="${accentHex}" stroke-width="2" opacity="0.7"/>
    <text x="36" y="52" fill="#F8FAFC" font-family="monospace" font-size="18" font-weight="bold">${safeTitle}</text>
    <text x="36" y="76" fill="#94A3B8" font-family="sans-serif" font-size="13">${safeSub}</text>
    ${illustration}
    <rect x="32" y="312" width="576" height="54" rx="10" fill="#020617" opacity="0.88" stroke="#334155" stroke-width="1"/>
    <text x="48" y="334" fill="#38BDF8" font-family="monospace" font-size="13" font-weight="bold">WEBRTC LIVE CAM • ${coordText}</text>
    <text x="48" y="354" fill="#E2E8F0" font-family="monospace" font-size="12">TIMESTAMP ${timeText} WIB • FILTER PIKSEL LOLOS</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function validatePhotoMetrics(metrics = {}) {
  const brightness = Number(metrics.brightness ?? 110);
  const sharpness = Number(metrics.sharpness ?? 42);
  const fromLiveCamera = metrics.fromLiveCamera !== false;
  const sizeKb = Number(metrics.sizeKb ?? 380);

  if (!fromLiveCamera) {
    return {
      ok: false,
      code: "GALLERY_BLOCKED",
      error: "Unggah galeri diblokir. Wajib gunakan kamera langsung (WebRTC) di titik lokasi.",
    };
  }
  if (brightness < 45) {
    return {
      ok: false,
      code: "PHOTO_TOO_DARK",
      error: `Foto ditolak filter piksel lokal: Terlalu gelap (kecerahan ${Math.round(
        brightness
      )}/255, minimal 45). Silakan jepret ulang dengan pencahayaan cukup.`,
    };
  }
  if (sharpness < 18) {
    return {
      ok: false,
      code: "PHOTO_TOO_BLURRY",
      error: `Foto ditolak filter piksel lokal: Terlalu buram/blur (ketajaman ${Math.round(
        sharpness
      )}, minimal 18). Tahan posisi kamera dan jepret ulang.`,
    };
  }
  return {
    ok: true,
    brightness: Math.round(brightness),
    sharpness: Math.round(sharpness),
    sizeKb: Math.min(400, Math.max(85, Math.round(sizeKb))),
  };
}

function appendAudit(ticket, { action, actorId, actorRole, statusFrom, statusTo, gpsDistanceMeters = null, note }) {
  const prevHash =
    ticket.auditChain.length > 0
      ? ticket.auditChain[ticket.auditChain.length - 1].hash
      : "0000000000000000";
  const timestamp = new Date().toISOString();
  const entryPayload = {
    seq: ticket.auditChain.length + 1,
    action,
    actorId,
    actorRole,
    statusFrom,
    statusTo,
    gpsDistanceMeters:
      gpsDistanceMeters !== null ? Math.round(gpsDistanceMeters * 10) / 10 : null,
    note,
    timestamp,
  };
  const hash = computeAuditHash(prevHash, entryPayload);
  ticket.auditChain.push({
    ...entryPayload,
    prevHash,
    hash,
  });
}

function createInitialState() {
  const now = Date.now();
  const hour = 3600 * 1000;

  const agencies = structuredClone(INITIAL_AGENCIES);
  const profiles = structuredClone(INITIAL_PROFILES);

  // Seed tickets around Semarang / Politeknik Negeri Semarang (Polines Tembalang & Simpang Lima)
  const rawTickets = [
    {
      id: "LPK-2027-001",
      title: "Lubang Dalam di Jalur Utama Jl. Prof. Soedarto Tembalang",
      description:
        "Lubang diameter 80cm dengan kedalaman sekitar 12cm di dekat gerbang kampus Polines, rawan membuat pengendara motor terjatuh saat hujan.",
      category: "ROAD_DAMAGE",
      agencyId: "DINAS_PU",
      district: "Tembalang",
      address: "Jl. Prof. Soedarto No. 12, Tembalang, Semarang",
      lat: -7.05215,
      lng: 110.43532,
      status: "PENDING_VALIDATION",
      reporterId: "CITIZEN_1",
      reporterPseudonym: "Warga#1042",
      supportCount: 6,
      urgencyScore: 18,
      createdAtMs: now - 14 * hour,
      slaHours: 48,
      slaDeadlineMs: now + 34 * hour,
      slaPausedAtMs: now - 3 * hour,
      validationDeadlineMs: now + 45 * hour,
      disputeCount: 0,
      beforePhotoUrl: makeStampedSvgDataUrl({
        title: "BUKTI AWAL • LPK-2027-001",
        subtitle: "Jalan Berlubang Jl. Prof. Soedarto Tembalang",
        lat: -7.05215,
        lng: 110.43532,
        timestampIso: new Date(now - 14 * hour).toISOString(),
        accentHex: "#3B82F6",
        mode: "BEFORE",
      }),
      afterPhotoUrl: makeStampedSvgDataUrl({
        title: "BUKTI PERBAIKAN DINAS PU • LPK-2027-001",
        subtitle: "Pengaspalan Tambal Cepat (Cold Mix) Selesai",
        lat: -7.05212,
        lng: 110.43535,
        timestampIso: new Date(now - 3 * hour).toISOString(),
        accentHex: "#10B981",
        mode: "AFTER",
      }),
      disputePhotoUrl: null,
      photoMetrics: { brightness: 128, sharpness: 54, sizeKb: 372 },
      validations: [
        {
          citizenId: "CITIZEN_2",
          pseudonym: "Warga#2091",
          trustScore: 92,
          decision: "APPROVE",
          distanceMeters: 18.4,
          note: "Aspal sudah rata saat saya lewat pagi ini.",
          timestamp: new Date(now - 2 * hour).toISOString(),
        },
        {
          citizenId: "CITIZEN_3",
          pseudonym: "Warga#3110",
          trustScore: 85,
          decision: "APPROVE",
          distanceMeters: 31.2,
          note: "Sudah ditambal rapi, tinggal butuh 1 suara warga lagi untuk tutup tiket.",
          timestamp: new Date(now - 1 * hour).toISOString(),
        },
      ],
      disputes: [],
      auditChain: [],
    },
    {
      id: "LPK-2027-002",
      title: "3 Tiang Lampu PJU Padam Total di Tanjakan Gombel",
      description:
        "Tiga titik lampu penerangan jalan mati total sepanjang tikungan turunan Gombel, jarak pandang malam hari sangat gelap.",
      category: "STREET_LIGHT",
      agencyId: "DISHUB_PJU",
      district: "Banyumanik",
      address: "Jl. Setiabudi (Tanjakan Gombel), Banyumanik",
      lat: -7.0418,
      lng: 110.4215,
      status: "OPEN",
      reporterId: "CITIZEN_2",
      reporterPseudonym: "Warga#2091",
      supportCount: 4,
      urgencyScore: 12,
      createdAtMs: now - 4 * hour,
      slaHours: 24,
      slaDeadlineMs: now + 20 * hour,
      slaPausedAtMs: null,
      validationDeadlineMs: null,
      disputeCount: 0,
      beforePhotoUrl: makeStampedSvgDataUrl({
        title: "BUKTI AWAL • LPK-2027-002",
        subtitle: "Lampu PJU Padam Tanjakan Gombel",
        lat: -7.0418,
        lng: 110.4215,
        timestampIso: new Date(now - 4 * hour).toISOString(),
        accentHex: "#2563EB",
        mode: "BEFORE",
      }),
      afterPhotoUrl: null,
      disputePhotoUrl: null,
      photoMetrics: { brightness: 68, sharpness: 39, sizeKb: 356 },
      validations: [],
      disputes: [],
      auditChain: [],
    },
    {
      id: "LPK-2027-003",
      title: "Saluran Drainase Tersumbat Lumpur & Sampah Pasar Bulu",
      description:
        "Gorong-gorong meluap ke badan jalan karena endapan lumpur tebal, sempat diklaim selesai namun warga membantah karena masih tergenang.",
      category: "DRAINAGE_CLOG",
      agencyId: "DINAS_SDA",
      district: "Semarang Selatan",
      address: "Jl. Mgr Sugiyopranoto (Depan Pasar Bulu)",
      lat: -6.9845,
      lng: 110.4092,
      status: "DISPUTED",
      reporterId: "CITIZEN_1",
      reporterPseudonym: "Warga#1042",
      supportCount: 9,
      urgencyScore: 22,
      createdAtMs: now - 28 * hour,
      slaHours: 36,
      slaDeadlineMs: now + 8 * hour,
      slaPausedAtMs: null,
      validationDeadlineMs: null,
      disputeCount: 1,
      beforePhotoUrl: makeStampedSvgDataUrl({
        title: "BUKTI AWAL • LPK-2027-003",
        subtitle: "Saluran Drainase Meluap Depan Pasar Bulu",
        lat: -6.9845,
        lng: 110.4092,
        timestampIso: new Date(now - 28 * hour).toISOString(),
        accentHex: "#D97706",
        mode: "BEFORE",
      }),
      afterPhotoUrl: makeStampedSvgDataUrl({
        title: "KLAIM DINAS SDA #1 • LPK-2027-003",
        subtitle: "Pembersihan Permukaan Kisi Drainase",
        lat: -6.98448,
        lng: 110.40922,
        timestampIso: new Date(now - 10 * hour).toISOString(),
        accentHex: "#EA580C",
        mode: "AFTER",
      }),
      disputePhotoUrl: makeStampedSvgDataUrl({
        title: "BANTAHAN WARGA #1 • LPK-2027-003",
        subtitle: "Bagian Dalam Gorong-gorong Masih Mampet Total",
        lat: -6.98451,
        lng: 110.40919,
        timestampIso: new Date(now - 6 * hour).toISOString(),
        accentHex: "#7C3AED",
        mode: "DISPUTE",
      }),
      photoMetrics: { brightness: 115, sharpness: 47, sizeKb: 388 },
      validations: [],
      disputes: [
        {
          round: 1,
          citizenId: "CITIZEN_3",
          pseudonym: "Warga#3110",
          distanceMeters: 24.5,
          reason: "Hanya disapu bagian atasnya, air masih meluber ke jalan raya.",
          photoUrl: "dispute-round-1",
          timestamp: new Date(now - 6 * hour).toISOString(),
        },
      ],
      auditChain: [],
    },
    {
      id: "LPK-2027-004",
      title: "Tumpukan Sampah Liar Menutup Bahu Jalan Kaligawe",
      description:
        "Tumpukan sampah plastik dan limbah pasar meluber ke lajur kiri jalan arteri Kaligawe lebih dari batas SLA 24 jam.",
      category: "ILLEGAL_WASTE",
      agencyId: "DINAS_DLH",
      district: "Gayamsari",
      address: "Jl. Raya Kaligawe KM 4, Gayamsari",
      lat: -6.9612,
      lng: 110.4488,
      status: "OVERDUE",
      reporterId: "CITIZEN_4",
      reporterPseudonym: "Warga#4008",
      supportCount: 11,
      urgencyScore: 25,
      createdAtMs: now - 30 * hour,
      slaHours: 24,
      slaDeadlineMs: now - 6 * hour,
      slaPausedAtMs: null,
      validationDeadlineMs: null,
      disputeCount: 0,
      beforePhotoUrl: makeStampedSvgDataUrl({
        title: "BUKTI AWAL • LPK-2027-004",
        subtitle: "Tumpukan Sampah Liar Bahu Jalan Kaligawe",
        lat: -6.9612,
        lng: 110.4488,
        timestampIso: new Date(now - 30 * hour).toISOString(),
        accentHex: "#DC2626",
        mode: "BEFORE",
      }),
      afterPhotoUrl: null,
      disputePhotoUrl: null,
      photoMetrics: { brightness: 132, sharpness: 61, sizeKb: 391 },
      validations: [],
      disputes: [],
      auditChain: [],
    },
    {
      id: "LPK-2027-005",
      title: "Perbaikan Penutup Manhole Besi di Kawasan Simpang Lima",
      description:
        "Penutup manhole drainase yang ambles sudah diganti baru dan divalidasi oleh 3 warga sekitar.",
      category: "ROAD_DAMAGE",
      agencyId: "DINAS_PU",
      district: "Semarang Tengah",
      address: "Jl. Pandanaran - Lingkar Simpang Lima",
      lat: -6.9902,
      lng: 110.4229,
      status: "CLOSED",
      reporterId: "CITIZEN_1",
      reporterPseudonym: "Warga#1042",
      supportCount: 5,
      urgencyScore: 15,
      createdAtMs: now - 52 * hour,
      slaHours: 48,
      slaDeadlineMs: now - 4 * hour,
      slaPausedAtMs: now - 20 * hour,
      validationDeadlineMs: now - 2 * hour,
      disputeCount: 0,
      beforePhotoUrl: makeStampedSvgDataUrl({
        title: "BUKTI AWAL • LPK-2027-005",
        subtitle: "Manhole Ambles Jl. Pandanaran Simpang Lima",
        lat: -6.9902,
        lng: 110.4229,
        timestampIso: new Date(now - 52 * hour).toISOString(),
        accentHex: "#2563EB",
        mode: "BEFORE",
      }),
      afterPhotoUrl: makeStampedSvgDataUrl({
        title: "BUKTI SELESAI • LPK-2027-005",
        subtitle: "Manhole Besi Cor Baru Terpasang Presisi",
        lat: -6.99021,
        lng: 110.42289,
        timestampIso: new Date(now - 20 * hour).toISOString(),
        accentHex: "#16A34A",
        mode: "AFTER",
      }),
      disputePhotoUrl: null,
      photoMetrics: { brightness: 140, sharpness: 64, sizeKb: 360 },
      validations: [
        {
          citizenId: "CITIZEN_2",
          pseudonym: "Warga#2091",
          trustScore: 92,
          decision: "APPROVE",
          distanceMeters: 14.2,
          note: "Sudah dipasang pelat besi baru dan rata.",
          timestamp: new Date(now - 18 * hour).toISOString(),
        },
        {
          citizenId: "CITIZEN_3",
          pseudonym: "Warga#3110",
          trustScore: 85,
          decision: "APPROVE",
          distanceMeters: 29.0,
          note: "Aman dilintasi kendaraan roda dua.",
          timestamp: new Date(now - 16 * hour).toISOString(),
        },
        {
          citizenId: "CITIZEN_4",
          pseudonym: "Warga#4008",
          trustScore: 90,
          decision: "APPROVE",
          distanceMeters: 21.7,
          note: "Valid selesai, tidak bunyi lagi saat dilewati.",
          timestamp: new Date(now - 15 * hour).toISOString(),
        },
      ],
      disputes: [],
      auditChain: [],
    },
  ];

  for (const t of rawTickets) {
    appendAudit(t, {
      action: "CREATE_TICKET",
      actorId: t.reporterId,
      actorRole: "CITIZEN",
      statusFrom: null,
      statusTo: "OPEN",
      gpsDistanceMeters: 0,
      note: `Laporan dibuat via WebRTC Live Cam (${t.photoMetrics.sizeKb} KB, kecerahan ${t.photoMetrics.brightness}, ketajaman ${t.photoMetrics.sharpness}).`,
    });
    if (t.status !== "OPEN") {
      appendAudit(t, {
        action: "STATE_SYNC",
        actorId: "SYSTEM_SLA",
        actorRole: "SYSTEM",
        statusFrom: "OPEN",
        statusTo: t.status,
        gpsDistanceMeters: 12.0,
        note: `Status saat ini: ${STATUS_DICTIONARY[t.status]?.label || t.status}.`,
      });
    }
  }

  return {
    tickets: rawTickets,
    agencies,
    profiles,
    seqCounter: 6,
  };
}

let store = createInitialState();

export function resetDemoState() {
  store = createInitialState();
  return getFullSnapshot();
}

export function evaluateOverdueTickets(nowMs = Date.now()) {
  for (const t of store.tickets) {
    if (
      (t.status === "OPEN" || t.status === "IN_PROGRESS") &&
      nowMs > t.slaDeadlineMs
    ) {
      const prev = t.status;
      t.status = "OVERDUE";
      appendAudit(t, {
        action: "SLA_DEADLINE_BREACHED",
        actorId: "PUBLIC_SLA_TIMER",
        actorRole: "SYSTEM",
        statusFrom: prev,
        statusTo: "OVERDUE",
        note: "Tenggat waktu SLA publik terlampaui sebelum bukti perbaikan diunggah.",
      });
    }
  }
}

export function checkRadiusQuota(lat, lng, category, radiusMeters = 50) {
  evaluateOverdueTickets();
  const numLat = Number(lat);
  const numLng = Number(lng);
  const nearbyTickets = [];

  for (const t of store.tickets) {
    if (t.status === "CLOSED") continue;
    if (category && t.category !== category) continue;
    const dist = haversineMeters(numLat, numLng, t.lat, t.lng);
    if (dist <= radiusMeters) {
      nearbyTickets.push({
        id: t.id,
        title: t.title,
        category: t.category,
        status: t.status,
        distanceMeters: Math.round(dist * 10) / 10,
        supportCount: t.supportCount,
      });
    }
  }

  const maxQuota = 3;
  const activeCount = nearbyTickets.length;
  return {
    allowed: activeCount < maxQuota,
    activeCount,
    maxQuota,
    radiusMeters,
    nearbyTickets,
  };
}

export function createTicket(payload) {
  evaluateOverdueTickets();
  const {
    title,
    description,
    category,
    district = "Tembalang",
    address = "Titik Koordinat Peta Publik",
    lat,
    lng,
    reporterId = "CITIZEN_1",
    photoDataUrl,
    photoMetrics,
  } = payload;

  const numLat = Number(lat);
  const numLng = Number(lng);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLng)) {
    return { ok: false, status: 400, error: "Koordinat GPS tidak valid." };
  }
  if (!title || String(title).trim().length < 5) {
    return {
      ok: false,
      status: 400,
      error: "Judul laporan minimal 5 karakter.",
    };
  }

  const catObj =
    CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  // 1. Check 50-meter radius quota (max 3 active reports in same category)
  const quota = checkRadiusQuota(numLat, numLng, catObj.id, 50);
  if (!quota.allowed) {
    return {
      ok: false,
      status: 409,
      code: "RADIUS_QUOTA_LOCKED",
      error: `Titik ini sudah memiliki ${quota.activeCount} laporan aktif dalam radius 50 meter. Pembuatan laporan baru dikunci; silakan gunakan tombol Dukung Prioritas.`,
      quota,
    };
  }

  // 2. Check local pixel filter & live camera requirement
  const pixelCheck = validatePhotoMetrics(photoMetrics);
  if (!pixelCheck.ok) {
    return {
      ok: false,
      status: 422,
      code: pixelCheck.code,
      error: pixelCheck.error,
    };
  }

  const reporter =
    store.profiles.find((p) => p.id === reporterId) || store.profiles[0];
  if (reporter.cooldownUntilMs > Date.now()) {
    return {
      ok: false,
      status: 429,
      error: "Akun sedang dalam masa pembatasan sementara (cooldown).",
    };
  }

  const now = Date.now();
  const id = `LPK-2027-${String(store.seqCounter++).padStart(3, "0")}`;
  const slaDeadlineMs = now + catObj.slaHours * 3600 * 1000;

  const finalPhotoUrl =
    typeof photoDataUrl === "string" && photoDataUrl.startsWith("data:image/")
      ? photoDataUrl
      : makeStampedSvgDataUrl({
          title: `BUKTI AWAL • ${id}`,
          subtitle: String(title).trim(),
          lat: numLat,
          lng: numLng,
          timestampIso: new Date(now).toISOString(),
          accentHex: "#2563EB",
          mode: "BEFORE",
        });

  const newTicket = {
    id,
    title: String(title).trim(),
    description: String(description || "Dilaporkan langsung dari lokasi kejadian.").trim(),
    category: catObj.id,
    agencyId: catObj.defaultAgencyId,
    district: String(district).trim(),
    address: String(address).trim(),
    lat: numLat,
    lng: numLng,
    status: "OPEN",
    reporterId: reporter.id,
    reporterPseudonym: reporter.pseudonym,
    supportCount: 1,
    urgencyScore: catObj.dangerWeight * 3,
    createdAtMs: now,
    slaHours: catObj.slaHours,
    slaDeadlineMs,
    slaPausedAtMs: null,
    validationDeadlineMs: null,
    disputeCount: 0,
    beforePhotoUrl: finalPhotoUrl,
    afterPhotoUrl: null,
    disputePhotoUrl: null,
    photoMetrics: {
      brightness: pixelCheck.brightness,
      sharpness: pixelCheck.sharpness,
      sizeKb: pixelCheck.sizeKb,
    },
    validations: [],
    disputes: [],
    auditChain: [],
  };

  appendAudit(newTicket, {
    action: "CREATE_TICKET",
    actorId: reporter.id,
    actorRole: "CITIZEN",
    statusFrom: null,
    statusTo: "OPEN",
    gpsDistanceMeters: 0,
    note: `Laporan baru lolos filter piksel (kecerahan ${pixelCheck.brightness}, ketajaman ${pixelCheck.sharpness}, ukuran ${pixelCheck.sizeKb} KB). Timer SLA ${catObj.slaHours} jam dimulai.`,
  });

  reporter.reportsCreated += 1;
  store.tickets.unshift(newTicket);

  return { ok: true, status: 201, ticket: newTicket };
}

export function supportTicketPriority(ticketId, citizenId = "CITIZEN_2") {
  evaluateOverdueTickets();
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return { ok: false, status: 404, error: "Tiket tidak ditemukan." };
  }
  if (ticket.status === "CLOSED") {
    return { ok: false, status: 409, error: "Tiket sudah ditutup permanen." };
  }

  ticket.supportCount += 1;
  ticket.urgencyScore += 3;

  const citizen =
    store.profiles.find((p) => p.id === citizenId) || store.profiles[0];

  appendAudit(ticket, {
    action: "SUPPORT_PRIORITY",
    actorId: citizen.id,
    actorRole: "CITIZEN",
    statusFrom: ticket.status,
    statusTo: ticket.status,
    note: `${citizen.pseudonym} menekan Dukung Prioritas (total dukungan: ${ticket.supportCount}).`,
  });

  return { ok: true, status: 200, ticket };
}

export function transferTicketAgency(
  ticketId,
  { targetAgencyId, reason, actorId = "ADMIN_PU" }
) {
  evaluateOverdueTickets();
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return { ok: false, status: 404, error: "Tiket tidak ditemukan." };
  }
  if (ticket.status !== "OPEN" && ticket.status !== "OVERDUE") {
    return {
      ok: false,
      status: 409,
      error: "Oper wewenang hanya dapat dilakukan sebelum pengerjaan dimulai.",
    };
  }

  const elapsedHours = (Date.now() - ticket.createdAtMs) / (3600 * 1000);
  if (elapsedHours > 24) {
    return {
      ok: false,
      status: 409,
      code: "TRANSFER_WINDOW_EXPIRED",
      error: `Batas waktu maksimal 24 jam pertama untuk Oper Tiket sudah lewat (${Math.round(
        elapsedHours
      )} jam berjalan). Dinas wajib menangani tiket ini.`,
    };
  }

  const targetAgency = store.agencies.find((a) => a.id === targetAgencyId);
  if (!targetAgency || targetAgency.id === ticket.agencyId) {
    return {
      ok: false,
      status: 400,
      error: "Pilih instansi tujuan pengalihan yang berbeda dan valid.",
    };
  }

  const prevAgency = store.agencies.find((a) => a.id === ticket.agencyId);
  if (prevAgency) prevAgency.transfersOut += 1;

  const oldAgencyName = prevAgency ? prevAgency.shortName : ticket.agencyId;
  ticket.agencyId = targetAgency.id;
  // Reset SLA fairly for the receiving agency
  ticket.slaDeadlineMs = Date.now() + ticket.slaHours * 3600 * 1000;
  ticket.status = "OPEN";

  appendAudit(ticket, {
    action: "TRANSFER_DINAS",
    actorId,
    actorRole: "ADMIN_DINAS",
    statusFrom: "OPEN",
    statusTo: "OPEN",
    note: `Tiket dialihkan resmi dari ${oldAgencyName} ke ${targetAgency.name} dalam jendela 24 jam pertama. Alasan: ${
      reason || "Penyesuaian wewenang teknis"
    }. Timer SLA disesuaikan secara adil.`,
  });

  return { ok: true, status: 200, ticket };
}

export function startTicketWork(ticketId, { actorId = "ADMIN_PU", note = "" } = {}) {
  evaluateOverdueTickets();
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return { ok: false, status: 404, error: "Tiket tidak ditemukan." };
  }
  if (ticket.status === "CLOSED" || ticket.status === "PENDING_VALIDATION") {
    return {
      ok: false,
      status: 409,
      error: `Tiket berstatus ${ticket.status} tidak dapat diubah ke pengerjaan.`,
    };
  }

  const prevStatus = ticket.status;
  ticket.status =
    Date.now() > ticket.slaDeadlineMs ? "OVERDUE" : "IN_PROGRESS";

  appendAudit(ticket, {
    action: "START_WORK",
    actorId,
    actorRole: "ADMIN_DINAS",
    statusFrom: prevStatus,
    statusTo: ticket.status,
    note:
      note ||
      "Petugas instansi menerima tiket dan memulai pengerjaan di lapangan. Timer SLA tetap berjalan.",
  });

  return { ok: true, status: 200, ticket };
}

export function submitRepairEvidence(
  ticketId,
  {
    officerLat,
    officerLng,
    afterPhotoUrl,
    photoMetrics,
    note = "",
    actorId = "ADMIN_PU",
  }
) {
  evaluateOverdueTickets();
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return { ok: false, status: 404, error: "Tiket tidak ditemukan." };
  }
  if (ticket.status === "CLOSED") {
    return { ok: false, status: 409, error: "Tiket sudah ditutup permanen." };
  }

  const dist = haversineMeters(
    ticket.lat,
    ticket.lng,
    Number(officerLat),
    Number(officerLng)
  );
  if (!Number.isFinite(dist) || dist > 50) {
    return {
      ok: false,
      status: 403,
      code: "GPS_OUT_OF_RANGE_50M",
      distanceMeters: Math.round(dist || 999),
      error: `Kunci GPS Petugas: Jarak Anda ${Math.round(
        dist || 999
      )} meter dari titik laporan. Wajib berada dalam radius maksimal 50 meter untuk unggah bukti perbaikan.`,
    };
  }

  const pixelCheck = validatePhotoMetrics(photoMetrics);
  if (!pixelCheck.ok) {
    return {
      ok: false,
      status: 422,
      code: pixelCheck.code,
      error: pixelCheck.error,
    };
  }

  const now = Date.now();
  const prevStatus = ticket.status;
  ticket.status = "PENDING_VALIDATION";
  ticket.slaPausedAtMs = now;
  ticket.validationDeadlineMs = now + 48 * 3600 * 1000;
  ticket.validations = [];
  ticket.afterPhotoUrl =
    typeof afterPhotoUrl === "string" && afterPhotoUrl.startsWith("data:image/")
      ? afterPhotoUrl
      : makeStampedSvgDataUrl({
          title: `BUKTI PERBAIKAN • ${ticket.id}`,
          subtitle: note || "Perbaikan fisik selesai dikerjakan di lokasi",
          lat: Number(officerLat),
          lng: Number(officerLng),
          timestampIso: new Date(now).toISOString(),
          accentHex: "#10B981",
          mode: "AFTER",
        });

  appendAudit(ticket, {
    action: "SUBMIT_REPAIR",
    actorId,
    actorRole: "ADMIN_DINAS",
    statusFrom: prevStatus,
    statusTo: "PENDING_VALIDATION",
    gpsDistanceMeters: dist,
    note: `Bukti perbaikan diunggah dari jarak ${Math.round(
      dist
    )}m (<= 50m). Timer SLA dihentikan; masuk Masa Uji Publik 48 Jam.`,
  });

  return { ok: true, status: 200, ticket };
}

export function submitCitizenValidation(
  ticketId,
  {
    citizenId = "CITIZEN_2",
    citizenLat,
    citizenLng,
    decision,
    counterPhotoUrl,
    photoMetrics,
    note = "",
  }
) {
  evaluateOverdueTickets();
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return { ok: false, status: 404, error: "Tiket tidak ditemukan." };
  }
  if (ticket.status !== "PENDING_VALIDATION") {
    return {
      ok: false,
      status: 409,
      error: "Tiket sedang tidak dalam Masa Uji Publik (PENDING_VALIDATION).",
    };
  }

  const citizen =
    store.profiles.find((p) => p.id === citizenId) || store.profiles[1];

  const isReporterFallbackAfter48h =
    citizen.id === ticket.reporterId &&
    ticket.validations.length === 0 &&
    ticket.validationDeadlineMs !== null &&
    Date.now() >= ticket.validationDeadlineMs;

  const dist = haversineMeters(
    ticket.lat,
    ticket.lng,
    Number(citizenLat),
    Number(citizenLng)
  );
  if (!isReporterFallbackAfter48h && (!Number.isFinite(dist) || dist > 100)) {
    return {
      ok: false,
      status: 403,
      code: "GPS_OUT_OF_RANGE_100M",
      distanceMeters: Math.round(dist || 999),
      error: `Kunci Radius Warga: Posisi Anda ${Math.round(
        dist || 999
      )} meter dari titik lokasi. Validasi warga sekitar wajib berada dalam radius maksimal 100 meter.`,
    };
  }

  if (decision === "APPROVE") {
    if (isReporterFallbackAfter48h) {
      const prevStatus = ticket.status;
      ticket.status = "CLOSED";
      citizen.trustScore = Math.min(100, citizen.trustScore + 5);
      appendAudit(ticket, {
        action: "REPORTER_FINAL_CLOSE_48H",
        actorId: citizen.id,
        actorRole: "CITIZEN",
        statusFrom: prevStatus,
        statusTo: "CLOSED",
        gpsDistanceMeters: dist,
        note: "Masa uji publik 48 jam habis tanpa validator sekitar; Pelapor Utama mengonfirmasi perbaikan selesai. Tiket dikunci permanen.",
      });
      return { ok: true, status: 200, ticket };
    }

    if (ticket.validations.some((v) => v.citizenId === citizen.id)) {
      return {
        ok: false,
        status: 409,
        error: `${citizen.pseudonym} sudah memberikan suara validasi pada putaran ini.`,
      };
    }

    ticket.validations.push({
      citizenId: citizen.id,
      pseudonym: citizen.pseudonym,
      trustScore: citizen.trustScore,
      decision: "APPROVE",
      distanceMeters: Math.round(dist * 10) / 10,
      note: note || "Konfirmasi 1-Tap: Kondisi lapangan sudah beres.",
      timestamp: new Date().toISOString(),
    });
    citizen.validationsDone += 1;

    if (ticket.validations.length >= 3) {
      const prevStatus = ticket.status;
      ticket.status = "CLOSED";
      // Reward reporter and validators
      const reporter = store.profiles.find((p) => p.id === ticket.reporterId);
      if (reporter) reporter.trustScore = Math.min(100, reporter.trustScore + 5);
      for (const v of ticket.validations) {
        const valProf = store.profiles.find((p) => p.id === v.citizenId);
        if (valProf) valProf.trustScore = Math.min(100, valProf.trustScore + 3);
      }

      appendAudit(ticket, {
        action: "QUORUM_CLOSED",
        actorId: citizen.id,
        actorRole: "CITIZEN",
        statusFrom: prevStatus,
        statusTo: "CLOSED",
        gpsDistanceMeters: dist,
        note: `Suara ke-3 dari ${citizen.pseudonym} (radius ${Math.round(
          dist
        )}m) melengkapi kuorum 3 warga. Tiket sah CLOSED permanen; Trust Score pelapor & validator naik.`,
      });
    } else {
      appendAudit(ticket, {
        action: "VALIDATE_APPROVE",
        actorId: citizen.id,
        actorRole: "CITIZEN",
        statusFrom: "PENDING_VALIDATION",
        statusTo: "PENDING_VALIDATION",
        gpsDistanceMeters: dist,
        note: `Konfirmasi 1-Tap "Sudah Beres" oleh ${citizen.pseudonym} (bobot Trust ${citizen.trustScore}, jarak ${Math.round(
          dist
        )}m). Kuorum: ${ticket.validations.length}/3 suara.`,
      });
    }

    return { ok: true, status: 200, ticket };
  }

  if (decision === "DISPUTE") {
    const pixelCheck = validatePhotoMetrics(photoMetrics);
    if (!pixelCheck.ok) {
      return {
        ok: false,
        status: 422,
        code: pixelCheck.code,
        error: pixelCheck.error,
      };
    }

    ticket.disputeCount += 1;
    citizen.disputesSubmitted += 1;
    citizen.validationsDone += 1;

    const now = Date.now();
    const disputePhoto =
      typeof counterPhotoUrl === "string" &&
      counterPhotoUrl.startsWith("data:image/")
        ? counterPhotoUrl
        : makeStampedSvgDataUrl({
            title: `BANTAHAN WARGA #${ticket.disputeCount} • ${ticket.id}`,
            subtitle: note || "Kondisi di lapangan masih rusak / klaim palsu",
            lat: Number(citizenLat),
            lng: Number(citizenLng),
            timestampIso: new Date(now).toISOString(),
            accentHex: "#7C3AED",
            mode: "DISPUTE",
          });

    ticket.disputePhotoUrl = disputePhoto;
    ticket.disputes.push({
      round: ticket.disputeCount,
      citizenId: citizen.id,
      pseudonym: citizen.pseudonym,
      distanceMeters: Math.round(dist * 10) / 10,
      reason: note || "Fasilitas di lokasi masih rusak berdasarkan foto terbaru.",
      photoUrl: disputePhoto,
      timestamp: new Date(now).toISOString(),
    });

    const prevStatus = ticket.status;
    // Aturan Batas Sengketa: maksimal 2 kali putaran bantahan -> ESCALATED + potong skor dinas
    if (ticket.disputeCount >= 2) {
      ticket.status = "ESCALATED";
      const agency = store.agencies.find((a) => a.id === ticket.agencyId);
      if (agency) {
        agency.penaltyPoints += 15;
      }
      appendAudit(ticket, {
        action: "DISPUTE_ESCALATED",
        actorId: citizen.id,
        actorRole: "CITIZEN",
        statusFrom: prevStatus,
        statusTo: "ESCALATED",
        gpsDistanceMeters: dist,
        note: `Bantahan foto ke-${ticket.disputeCount} oleh ${citizen.pseudonym} (radius ${Math.round(
          dist
        )}m). Batas sengketa 2x tercapai: status berubah menjadi ESCALATED dan skor integritas ${
          agency ? agency.shortName : ticket.agencyId
        } dipotong -15 poin!`,
      });
    } else {
      ticket.status = "DISPUTED";
      ticket.slaPausedAtMs = null;
      appendAudit(ticket, {
        action: "DISPUTE_FAKE_CLOSURE",
        actorId: citizen.id,
        actorRole: "CITIZEN",
        statusFrom: prevStatus,
        statusTo: "DISPUTED",
        gpsDistanceMeters: dist,
        note: `Klaim selesai dibantah oleh ${citizen.pseudonym} dengan bukti foto lapangan dari jarak ${Math.round(
          dist
        )}m. Status menjadi DISPUTED (putaran 1/2) dan kembali ke antrean dinas.`,
      });
    }

    return { ok: true, status: 200, ticket };
  }

  return {
    ok: false,
    status: 400,
    error: "Keputusan validasi harus APPROVE atau DISPUTE.",
  };
}

export function simulateTicketTimeShift(ticketId, mode = "EXPIRE_24H_OR_SLA") {
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return { ok: false, status: 404, error: "Tiket tidak ditemukan." };
  }

  const hour = 3600 * 1000;
  if (mode === "FAST_FORWARD_48H_VALIDATION") {
    ticket.validationDeadlineMs = Date.now() - 1 * hour;
    ticket.validations = [];
    appendAudit(ticket, {
      action: "SIMULATION_TIME_SHIFT",
      actorId: "JURY_SIMULATOR",
      actorRole: "JURY",
      statusFrom: ticket.status,
      statusTo: ticket.status,
      note: "Simulasi Juri: Waktu uji publik dimajukan melewati 48 jam dengan 0 validator untuk menguji tombol Keputusan Akhir Pelapor Utama.",
    });
  } else {
    ticket.createdAtMs = Date.now() - 50 * hour;
    ticket.slaDeadlineMs = Date.now() - 2 * hour;
    evaluateOverdueTickets();
    appendAudit(ticket, {
      action: "SIMULATION_TIME_SHIFT",
      actorId: "JURY_SIMULATOR",
      actorRole: "JURY",
      statusFrom: "OPEN",
      statusTo: ticket.status,
      note: "Simulasi Juri: Waktu tiket dimajukan melewati batas 24 jam oper tiket dan tenggat SLA (OVERDUE).",
    });
  }

  return { ok: true, status: 200, ticket };
}

export function getAgencyScorecards() {
  evaluateOverdueTickets();
  return store.agencies.map((agency) => {
    const agencyTickets = store.tickets.filter((t) => t.agencyId === agency.id);
    const total = agencyTickets.length;
    const closedCount = agencyTickets.filter((t) => t.status === "CLOSED").length;
    const overdueCount = agencyTickets.filter((t) => t.status === "OVERDUE").length;
    const disputedCount = agencyTickets.filter(
      (t) => t.status === "DISPUTED" || t.disputeCount > 0
    ).length;
    const escalatedCount = agencyTickets.filter(
      (t) => t.status === "ESCALATED"
    ).length;

    const onTimeCount = agencyTickets.filter(
      (t) => t.status !== "OVERDUE" && t.status !== "ESCALATED"
    ).length;
    const slaOnTimePct =
      total > 0 ? Math.round((onTimeCount / total) * 100) : 100;

    const integrityScore = Math.max(
      0,
      agency.baseIntegrityScore -
        agency.penaltyPoints -
        overdueCount * 4 -
        disputedCount * 5
    );

    return {
      ...agency,
      totalTickets: total,
      closedCount,
      overdueCount,
      disputedCount,
      escalatedCount,
      slaOnTimePct,
      integrityScore,
    };
  });
}

export function getFullSnapshot() {
  evaluateOverdueTickets();
  const scorecards = getAgencyScorecards();

  const districtStats = {};
  for (const t of store.tickets) {
    if (!districtStats[t.district]) {
      districtStats[t.district] = {
        district: t.district,
        total: 0,
        active: 0,
        overdueOrDisputed: 0,
        lat: t.lat,
        lng: t.lng,
      };
    }
    districtStats[t.district].total += 1;
    if (t.status !== "CLOSED") districtStats[t.district].active += 1;
    if (
      t.status === "OVERDUE" ||
      t.status === "DISPUTED" ||
      t.status === "ESCALATED"
    ) {
      districtStats[t.district].overdueOrDisputed += 1;
    }
  }

  return {
    tickets: store.tickets,
    agencies: scorecards,
    profiles: store.profiles,
    categories: CATEGORIES,
    statusDictionary: STATUS_DICTIONARY,
    heatmapZones: Object.values(districtStats),
    summary: {
      totalTickets: store.tickets.length,
      activeTickets: store.tickets.filter((t) => t.status !== "CLOSED").length,
      pendingValidation: store.tickets.filter(
        (t) => t.status === "PENDING_VALIDATION"
      ).length,
      overdueTickets: store.tickets.filter((t) => t.status === "OVERDUE").length,
      disputedOrEscalated: store.tickets.filter(
        (t) => t.status === "DISPUTED" || t.status === "ESCALATED"
      ).length,
      closedVerified: store.tickets.filter((t) => t.status === "CLOSED").length,
    },
  };
}
