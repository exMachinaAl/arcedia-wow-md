# WOW V3.0.0 / Tahap 1 — Chat Identity (Identity + Mirror only)

## Keamanan dan batas versi

- **Tidak ada penghapusan pesan asli** di rilis ini. `.wowchat mode replace` belum tersedia; `.wowchat mode identity|mirror` saja.
- Semuanya **OFF default**: `WA_ENABLE_GROUPS=true` di `.env` (gateway), `.admin chat global on` (Admin WOW di DM), `.wowchat enable` (admin grup), `.wowchat mode mirror` (admin grup), `.chatstyle on` (pemain di DM).
- Akun bot hanya mengirim pesan **atas nama WOW Bot**, dengan `@nickname`, tag WOW stabil berdasar hash pengirim, dan mention JID asli. Bot tidak dapat mengubah author native WhatsApp.
- Tahap 1 hanya menangani pesan teks 1–280 karakter dan tidak pernah merelay perintah, media, stiker, status, broadcast, pesan dari bot, atau chat DM.
- Pengirim harus opt-in dan admin grup bisa `.wowchat block @mention` / `.wowchat unblock @mention`. Mention harus dipilih melalui fitur mention WhatsApp yang asli.
- Admin Grup diverifikasi dari metadata WhatsApp untuk perintah grup; Admin WOW diverifikasi dengan `WOW_ADMIN_IDS` yang ditetapkan lewat `SETUP-WOW-ADMIN.bat`.

## Contoh penggunaan

1. Pada server, aktifkan `.env` `WA_ENABLE_GROUPS=true`, set `WA_ALLOWED_JIDS` bila melakukan uji terbatas, lalu restart gateway `WA-START.bat`.
2. Admin WOW via DM: `.admin chat global on` (untuk mematikan seketika: `.admin chat global off`).
3. Admin WhatsApp grup: `.wowchat enable` kemudian `.wowchat mode mirror`. Grup lama yang memakai Guild Group tidak otomatis mengaktifkan Mirror.
4. Pemain via DM: `.chatstyle on`; `.chatstyle preview` untuk melihat contoh desain. Equip dari `.inventory` atau `.item equip ...`.
5. Pemain menulis pesan normal di grup. Pesan asli tetap utuh. Bot mencetak identitas/decoration dan mention pemain. Mode `.wowchat mode identity` menghentikan mirror otomatis tetapi pratinjau masih tersedia.
6. Admin: `.wowchat disable` mematikan satu grup. `.admin chat global off` mematikan semua grup.

## Operasional antrian

- Maksimal 300 pesan pending server, 30 pending per grup, satu pesan per pemain per 6 detik per grup; satu pesan keluaran per grup per 1,5 detik. Pemrosesan keluar global satu job setiap 1,5 detik dan tidak menjamin throughput WhatsApp.
- Antrean SQLite bersifat persisten, deduplikasi memakai JID grup + JID pengguna + WhatsApp message id. Isi pesan dihapus dari queue setelah terkirim/gagal/dilewati. Metadata hasil dihapus setelah 7 hari.
- Setelah restart, pekerjaan SENDING menjadi AMBIGUOUS tanpa kirim ulang otomatis; menghindari duplikasi saat server crash setelah kirim tetapi sebelum ack. Ini berarti beberapa pesan mungkin tidak dimirror, namun pesan asli tetap ada.
- Pending >45 detik dilewati. Jika tidak connected, queue menunggu sambil tetap dilindungi TTL. Saat penuh/burst, mirror dilewati dan pesan asli normal.
- `SENT` berarti `sendMessage` mengembalikan hasil tanpa error, bukan bukti semua klien grup menampilkan pesan.
- Pada source patch rollback, data SQLite tidak di-rollback. Cadangkan folder `data/` sesudah mematikan seluruh proses sebelum install.

## Pengujian live (wajib sebelum grup publik)

1. Verifikasi admin, pemain opt-in, guild/perintah lain tidak terganggu.
2. Kirim satu pesan normal dan periksa bot menampilkan nickname, tag WOW dan equipment dengan mention klik.
3. Pastikan tidak ada penghapusan pesan asli, tidak ada loop bot, tidak ada otomatisasi dalam grup di luar allowlist.
4. Matikan `.admin chat global off` dan pastikan pesan berikutnya tidak didekorasi.
5. Gunakan sebuah grup uji dengan akun khusus. Hindari spam buatan di WhatsApp sesungguhnya.

**PENDING_LIVE:** validasi live Baileys, atribusi mention `@lid`, ketahanan disconnect, dan limitasi akun WhatsApp; 336 tes offline tidak membuktikan hal-hal tersebut.

## Tahap berikutnya

- V3 Tahap 2: safe replace optional, bot admin check, send confirmation, delete original only if eligible, failed delete fallback, dan pengaturan per grup/pemain.
- V3 Tahap 3: equipment theme presets, visual showcase terbatas, observability queue, dan pengujian burst sintetis berskala lebih besar.
