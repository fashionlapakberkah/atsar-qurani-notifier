/**
 * Atsar Qurani — loop pengirim FCM (~1 jam, gratis di repo publik).
 *
 * Dijalankan oleh workflow per jam; tiap 5 menit memanggil sender.js
 * sebagai proses anak, lalu tidur. Total 12 siklus ≈ 58 menit.
 * Desain ini tidak bergantung pada ketepatan cron 5-menitan GitHub:
 * setiap tembakan cron (per jam) membeli ~1 jam cakupan kirim 5-menitan.
 * Anti-kirim-ganda tetap dijamin sender.js via _meta/fcmNotify.
 */

const { spawnSync } = require('child_process');

const CYCLES = 12;
const GAP_MS = 5 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  for (let i = 0; i < CYCLES; i++) {
    console.log(`--- siklus ${i + 1}/${CYCLES} ${new Date().toISOString()}`);
    const r = spawnSync(process.execPath, ['sender.js'], {
      cwd: __dirname,
      stdio: 'inherit',
      encoding: 'utf8',
    });
    if (r.status !== 0) console.error(`siklus ${i + 1} exit ${r.status}`);
    if (i < CYCLES - 1) await sleep(GAP_MS);
  }
  console.log('LOOP SELESAI');
})().catch((e) => { console.error('GAGAL:', e.message); process.exit(1); });
