# WOW v3.0.0 — Setup Grup & `.env.example` (didasarkan pada source)

## Apa yang perlu dilakukan?

1. Ekstrak paket ini **di samping** folder `WA-WORLD-Starter` yang telah ada sehingga folder bergabung. Paket **tidak memiliki `.env`**, jadi tidak menggantikan konfigurasi pribadi.
2. Jika `.env` **belum ada**, salin `.env.example` menjadi `.env` dan isi `WOW_ADMIN_IDS` (lebih baik dengan `SETUP-WOW-ADMIN.bat`). Jika `.env` **sudah ada**, **jangan timpa**: pastikan `WA_ENABLE_GROUPS=true` dan periksa `WA_ALLOWED_JIDS`.
3. Jalankan `CHECK-WOW-GROUP.bat` untuk memeriksa konfigurasi dan state Chat Identity lokal secara read-only.
4. Restart `WA-START.bat`. Log gateway harus berisi `groups=on` dan `Baileys terhubung`.
5. **DM akun Anda ke bot**: `.whoami`, lalu di PC server `SETUP-WOW-ADMIN.bat`, masukkan ID *persis* dari `.whoami`, restart bot, lalu DM `.admin show`.
6. **DM Admin WOW**: `.admin chat global on`.
7. **Di grup oleh admin grup atau Admin WOW yang dikenali**: `.wowchat enable`, `.wowchat mode mirror` dan `.wowchat` untuk status. Bot tidak menghapus pesan asli di tahap pertama.
8. **DM pemain**: `.chatstyle on`, `.chatstyle preview`; kemudian kirim teks biasa di grup.

## Apa arti Owner dan Admin?

- **Admin WOW**: akun ID yang terdaftar di `WOW_ADMIN_IDS` dan berwenang menjalankan perintah `.admin` melalui DM; di tahap ini belum ada jabatan `owner` tersendiri.
- **Admin grup WhatsApp**: pihak yang ditetapkan sebagai admin di informasi grup WhatsApp. Untuk `.wowchat`, bot mencocokkan JID pengirim dengan metadata admin; jika gagal, pesan `akses ditolak` mungkin muncul meski profil WhatsApp Anda terlihat admin. Kemungkinan ID `@lid` berbeda perlu dicek.
- **Owner guild WOW**: peran pemilik guild di database; tidak otomatis berwenang atas pengaturan admin WOW atau grup.

## Kenapa bot diam di grup?

- `WA_ENABLE_GROUPS` tidak tepat `true` (huruf kecil), bot belum direstart, atau bot belum tersambung.
- `WA_ALLOWED_JIDS` terisi dan memblokir pesan dari grup atau DM admin. Kosongkan untuk tes awal dalam grup privat.
- `.admin chat global on` belum dijalankan melalui DM admin WOW.
- `.wowchat enable` belum aktif, atau mode masih `identity`, bukan `mirror`.
- Pemain belum `.chatstyle on` via DM.
- Teks bukan teks normal (perintah `.`, media, lebih dari 280 karakter, dll.) atau rate limit 6 detik per pemain.
- Jika `.wowchat enable` gagal dengan `akses ditolak`, dapat terjadi ketidakcocokan JID admin grup yang dikenali Baileys, terutama antara format nomor dan `@lid`.
- Command seperti `.admin`, `.whoami`, dan mayoritas game *tidak tersedia di grup*: gunakan DM; coba `.wowchat` untuk memeriksa konfigurasi grup.

## Pengaturan yang **bukan** `.env`

`auction`, `transfer`, `arcade_spend_limit`, `arcade_win_limit`, `dailyshop_limit` dan setting ekonomi lainnya: lewat `.admin show` dan `.admin set KEY NILAI` (SQLite).

Mode Mirror tidak otomatis menyala hanya dengan `WA_ENABLE_GROUPS=true` karena global/grup/consent masih perlu diaktifkan satu per satu.

## Keamanan

- Jangan kirim file `.env` atau ID personal admin secara publik.
- `WOW_ADMIN_IDS` gunakan ID persis dari `.whoami`. Jika admin diperbarui lewat BAT, restart bot.
- Jangan mengubah `WA_DB_PATH` atau `WA_SESSION_DIR` jika data aktif berada pada path lain.
- `HOST` dan `PORT` dashboard dalam source v3.0.0 tidak otomatis dibaca dari `.env` oleh `start-dashboard.bat` (berbeda dengan `WA-START.bat`), jadi jalankan dari environment OS atau memakai `node --env-file=.env --experimental-sqlite src/server.js` jika membutuhkan port khusus.
- Setiap tes grup lakukan dengan akun uji; mode Replace belum tersedia pada tahap ini.
