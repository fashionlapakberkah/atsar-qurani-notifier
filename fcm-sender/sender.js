/**
 * Atsar Qurani — Pengirim notifikasi FCM via GitHub Actions (GRATIS).
 *
 * Dijalankan terjadwal (.github/workflows/fcm-notify.yml) tiap 5 menit.
 * Memindai dokumen BARU (createdAt > penanda) di tahsin / tahfidz /
 * targetHafalan / targetMurojaah, lalu push ke topik aq_user_<studentId> di HP siswa.
 *
 * Secret yang dibutuhkan (repo Settings > Secrets > Actions):
 *   GCLOUD_SERVICE_KEY = seluruh isi file serviceAccount.json
 *
 * Penanda + riwayat ID terkirim disimpan di Firestore (_meta/fcmNotify)
 * sehingga aman dari restart dan anti-kirim-ganda.
 */

const admin = require('firebase-admin');

const fs = require('fs');
const path = require('path');

function loadKey() {
  try {
    if (process.env.GCLOUD_SERVICE_KEY) return JSON.parse(process.env.GCLOUD_SERVICE_KEY);
  } catch (e) { /* lanjut ke file lokal */ }
  // Dipakai PC TU: serviceAccount.json ditaruh di samping sender.js (di-ignore git).
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'serviceAccount.json'), 'utf8'));
  } catch (e) { return {}; }
}
const KEY = loadKey();
if (!KEY.client_email || !KEY.private_key || !KEY.project_id) {
  console.error('GAGAL: kunci belum ada. Isi secret GCLOUD_SERVICE_KEY (GitHub) atau taruh serviceAccount.json di samping sender.js (PC).');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(KEY) });
const db = admin.firestore();
const messaging = admin.messaging();

const OVERLAP_MS = 120000; // tumpang-tindih 2 menit anti-lolos
const MAX_IDS = 500; // batas riwayat ID anti-ganda
const MAX_MSG = 200; // batas pesan per jalan

const COLLS = [
  {
    name: 'tahsin',
    title: 'Nilai Tahsin Baru',
    body: () => 'Ada nilai Tahsin baru untuk Ananda. Buka aplikasi untuk melihat.',
    data: (d, id) => ({ type: 'TAHSIN', rowId: d.id || id }),
  },
  {
    name: 'tahfidz',
    title: 'Setoran Tahfidz Baru',
    body: () => 'Ada setoran Tahfidz baru untuk Ananda. Buka aplikasi untuk melihat.',
    data: (d, id) => ({ type: 'TAHFIDZ', rowId: d.id || id }),
  },
  {
    name: 'targetHafalan',
    title: 'Target Hafalan Baru',
    body: () => 'Ada Target Hafalan baru untuk Ananda. Buka aplikasi untuk melihat.',
    data: (d, id) => ({ type: 'TARGET', rowId: d.id || id }),
  },
  {
    name: 'targetMurojaah',
    title: 'Target Murojaah Baru',
    body: () => 'Ada Target Murojaah baru untuk Ananda. Buka aplikasi untuk melihat.',
    data: (d, id) => ({ type: 'MUROJAAH', rowId: d.id || id }),
  },
];

function topicFor(studentId) {
  return 'aq_user_' + String(studentId || '').toLowerCase().replace(/[^a-z0-9]/g, '_');
}

async function main() {
  const metaRef = db.collection('_meta').doc('fcmNotify');
  const metaSnap = await metaRef.get();
  const meta = metaSnap.exists ? metaSnap.data() || {} : {};
  const since = Number(meta.lastRun || 0);
  const sentIds = new Set(Array.isArray(meta.sentIds) ? meta.sentIds : []);
  const runStart = Date.now();

  const messages = [];
  const freshIds = [];
  for (const c of COLLS) {
    const snap = await db.collection(c.name)
      .where('createdAt', '>', since > 0 ? since : runStart)
      .orderBy('createdAt')
      .limit(MAX_MSG)
      .get();
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const id = String(d.id || doc.id);
      if (sentIds.has(c.name + ':' + id)) return;
      if (!d.studentId) return;
      messages.push({
        topic: topicFor(d.studentId),
        notification: { title: c.title, body: c.body(d) },
        data: c.data(d, id),
        android: { priority: 'high' },
      });
      freshIds.push(c.name + ':' + id);
    });
  }

  let sent = 0;
  let failed = 0;
  if (messages.length) {
    const res = await messaging.sendEach(messages.slice(0, MAX_MSG));
    sent = res.successCount;
    failed = res.failureCount;
    res.responses.forEach((r, i) => {
      if (!r.success) console.error('Kirim gagal:', messages[i].topic, r.error && r.error.message);
    });
  }

  const kept = [...sentIds, ...freshIds].slice(-MAX_IDS);
  await metaRef.set({ lastRun: runStart - OVERLAP_MS, sentIds: kept }, { merge: true });
  console.log(`SELESAI: ${messages.length} baru, ${sent} terkirim, ${failed} gagal.`);
}

main().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
