# Atsar Qurani — Notifier Publik (pengirim FCM, gratis)

Repo minimal ini HANYA berisi pengirim notifikasi. Tidak ada data murid,
password, kunci, atau source aplikasi di sini.

## Isi
- `.github/workflows/fcm-notify.yml` — jadwal tiap 5 menit (repo publik = menit unlimited).
- `fcm-sender/` — skrip pemindai Firestore + pengirim FCM ke topik siswa.

## Cara pakai
1. Buat repo GitHub **publik** baru, upload seluruh isi folder ini ke akarnya.
2. Repo Settings → Secrets → Actions → New secret:
   `GCLOUD_SERVICE_KEY` = seluruh isi `serviceAccount.json` Firebase.
3. Tab Actions → pilih workflow → Run workflow (tes manual).
4. Selesai — jadwal 5 menitan berjalan otomatis.

## Privasi
Isi notifikasi generik ("Ada nilai baru, buka aplikasi") — nama dan nilai
hanya tampil di dalam aplikasi yang terkunci akun.
