# WOW v3.2.2 — Analisis dua repo tombol grup

## Referensi yang diperiksa secara statis

- XLICON V2: `plugins/main-menu2.js` memakai tiga `quick_reply` dan `single_select` dalam satu `nativeFlowMessage`; `generateWAMessageFromContent` dan `relayMessage` dengan `additionalNodes` biz/native_flow. Pada `package.json`, Baileys `^7.0.0-rc13` dan `gifted-btns`. Tidak pernah dijalankan di environment ini.
- XeonBot V7: `index.js` mengirim tombol `buttons`, template hydrated, dan metadata `fileLength` simulatif. Paket menggunakan fork lama `@adiwajshing/baileys` alias `@ferdiz-afk/baileys`, mencakup node_modules besar, dan dua pemanggilan `XeonBotIncBot()` di baris ~537 dan ~545 berisiko menjalankan koneksi ganda. Tidak pernah dieksekusi.
- WOW 3.2.1: sebelumnya `native` (3 tombol) dan `selector` terpisah. v3.2.2 menambah mode `mixed` **admin-only**, tanpa menyalin modul Xeon.

## Fitur eksperimen

`.groupbuttons mixed` mengirim 3 quick-reply dan 1 selector dengan 8 rows menggunakan `buttonParamsJson` serta metadata `additionalNodes`. Ini **bukan jaminan** bahwa 8 tombol native ditampilkan langsung; 8 adalah jumlah opsi selector. Klik dibaca hanya bila ID ada dalam allowlist.

## Uji nyata yang masih diperlukan

Coba pada grup uji admin: `.groupbuttons mixed`. Lihat ponsel common player (Android/iOS bila memungkinkan), buka `Jelajahi WOW`, pilih satu opsi, dan laporkan `.groupbuttons report shown|hidden|clicked`. Laporan terkirim dan rendering UI adalah hal berbeda.

## Keamanan

Source dari ZIP referensi hanya dibaca sebagai teks. Jangan menjalankan Xeon beserta node_modules ataupun menyalin file `.env`/autentikasi sumber. File length palsu dan modul crash/virtex tidak diadopsi. Pengaturan Replace/Delete tidak diubah.
