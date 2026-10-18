# WOW V3.1.0 — Safe Replace Engine (Tahap 2)

**Penting:** Real WhatsApp deletion dan callback Baileys belum diverifikasi secara live. Default Replace = OFF. Modifikasi memakai library Baileys tak resmi, dengan potensi pembatasan oleh platform. Gunakan satu grup uji dan akun khusus.

## Mengaktifkan
1. Jalankan `CHECK-WOW-GROUP.bat` (opsional, dari paket konfigurasi) atau periksa `.env` aktif: `WA_ENABLE_GROUPS=true`, `WA_ALLOWED_JIDS` harus mengizinkan akun admin dan grup. Jangan mengganti `WA_SESSION_DIR`/database yang sudah ada. Restart gateway hanya bila `.env` diubah.
2. Admin WOW (DM): `.admin chat global on` dan `.admin chat replace on`.
3. Admin grup WhatsApp: `.wowchat enable`, `.wowchat mode replace`, `.wowchat delete on`.
4. Pemain (DM): `.chatstyle on` dan `.chatstyle replace on`.
5. **Akun bot sendiri harus merupakan admin grup**; gateway akan membaca metadata WhatsApp sebelum meminta delete. Jika admin bot tidak bisa diverifikasi, pesan asli tetap ada.
6. Kirim pesan teks biasa maksimal 280 karakter. Bot mengirim versi berdekorasi dengan mention pengirim asli, lalu akan mencoba hapus pesan asli **hanya setelah ada `messages.update` dengan status DELIVERY_ACK >=3** untuk pesan bot tersebut dalam jendela 20 detik. SERVER_ACK=2 **tidak cukup**.

## Emergency stop
- Server DM: `.admin chat global off` atau `.admin chat replace off`
- Grup: `.wowchat delete off` atau `.wowchat disable`
- Pemain DM: `.chatstyle replace off` atau `.chatstyle off`

Saat OFF, semua izin penghapusan grup di-reset dan harus dinyalakan kembali secara eksplisit. Mirror tetap tersedia dengan `.wowchat mode mirror`.

## Jaminan aplikasi vs keterbatasan platform
- Program melakukan **permintaan revoke** hanya setelah konfirmasi delivery dan verifikasi admin. `DELETE_REQUESTED` berarti API mengembalikan sukses, **bukan bukti** semua klien WhatsApp telah menghapus pesan.
- WhatsApp bisa menampilkan placeholder "pesan dihapus", dan pesan sudah bisa terbaca sebelum dihapus.
- Tidak melakukan resend pekerjaan ambigu setelah crash. `DELETE_IN_FLIGHT`, `READY`, dan `WAIT_ACK` menjadi AMBIGUOUS/terbengkalai saat restart agar pesan lama **tidak dihapus terlambat**.
- Jika pengiriman bot gagal, tidak ada ACK, bot bukan admin, mode atau izin berubah, atau antrean overload, pesan asli **tetap utuh**. Bisa ada duplikasi sementara.
- Hanya teks biasa dari grup. Tidak memproses media, stiker, voice, DM, perintah bot, maupun pesan bot sendiri.
- V-Currency, guild, properti, blackjack, game lama tidak diubah.
- Antrean tetap memakai 300 pending global/30 per grup, rate limit pemain 6 detik, 1 grup 1,5 detik. Lebih banyak pesan daripada kapasitas → mode skip, **bukan** upaya menghapus pesan asli.

## Identitas owner/admin
- `.whoami` (DM) menunjukkan ID WA yang diperlukan untuk `SETUP-WOW-ADMIN.bat`. Admin WOW ditentukan ID yang disimpan di `.env` / OS (`WOW_ADMIN_IDS`).
- Admin WhatsApp grup diverifikasi metadata grup untuk perintah. Owner guild bukan admin bot.
- Pemeriksaan bot admin menggunakan `sock.user.id`/`sock.user.lid` dan metadata admin; jika LID tidak cocok maka skip. Ini lebih aman daripada menganggap bot admin.

## QA
- Jalankan `WA-TEST-OFFLINE.bat` atau `npm test` (Node 22.16+). Tanda OFFLINE PASS tidak membuktikan callback delivery atau revoke berhasil di ponsel Anda.
- Uji Mirror terlebih dahulu sebelum mengaktifkan Replace. Jika live belum pernah diuji, gunakan mode Mirror hingga hasil tersedia.
- Pastikan konfigurasi `WA_ENABLE_GROUPS` di `.env` aktif. `.env.example` tidak dibaca otomatis.
