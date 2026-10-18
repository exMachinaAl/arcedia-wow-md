# WOW v2.1 — Guild & Property Engine

## Ketentuan tetap
- Semua V adalah kredit virtual yang tidak punya nilai uang asli.
- Top-up, cash-out, konversi ke uang, dan transfer V langsung antar pemain dilarang.
- Guild treasury hanya menerima kontribusi **sukarela** dari wallet V untuk peningkatan Hall; tidak ada penarikan/pengembalian.
- Tidak ada auction/item transfer pada versi ini. Lelang/escrow masih tahap evaluasi.
- Guild maksimal 20 anggota; anggota hanya masuk melalui command dalam DM, dan bisa keluar.
- Semua mutasi dijalankan di transaksi SQLite BEGIN IMMEDIATE dengan `processed_messages` sebagai idempotency per message ID.
- Pemilik yang keluar harus menyerahkan kepemimpinan, atau membubarkan guild kosong dengan treasury nol.

## Command guild
- `.guild create NightWolves` — 60 V (guild berbayar dalam simulasi, bukan uang asli).
- `.guild list`, `.guild join nightwolves`, `.guild info`, `.guild members`.
- `.guild quest` — satu kontribusi harian per akun, menambah guild XP dan +3 XP pribadi.
- `.guild donate 20` — kontribusi ke kas (1–200 V/transaksi, maksimal 200 V/hari per pemain).
- `.guild upgrade` — Owner/Officer menggunakan kas untuk Hall Lv.2–5; tidak menghasilkan V baru.
- `.guild promote Alice`, `.guild demote Alice`, `.guild kick Alice`, `.guild transfer-owner Alice` — hanya Owner, target harus punya nickname.
- `.guild leave` dan `.guild disband`.

## Command properti
- `.property list`
- `.property buy home` (70 V), `.property buy workshop` (100 V), `.property buy quarry` (130 V).
- `.property collect home|workshop|quarry` — bonus harian (rumah: XP; workshop: Copper; quarry: Iron).
- `.property upgrade home|workshop|quarry` — bayar V + material. Lv.1–3, tiap level menggandakan bonus dasar pada collect.
- Material hasil mining lama otomatis disinkronkan lewat `wow_material_claims` saat perintah properti dipakai; tidak dapat diklaim dua kali.
- Semua properti account-bound dan tidak bisa dijual/ditransfer.

## Keamanan & batasan
- `core.process()` validasi event ID mengunci double-processing; `wow_v_events` menandai semua debit.
- `wow_guild_history` menyimpan jejak manajemen/kas. Data guild list hanya nama guild dan jumlah anggota, bukan nomor WhatsApp.
- Guild command DM-only di gateway; dukungan grup memerlukan opt-in, role mapping serta izin grup (backlog).
- Sudah ada recovery SQLite setelah restart, tetapi v2.1 live QA belum selesai.
- Ketahanan terhadap multiakun dan abuse jangka panjang tetap memerlukan pengujian real pengguna; jangan rilis sistem guild berbasis ekonomi secara publik sebelum audit.
