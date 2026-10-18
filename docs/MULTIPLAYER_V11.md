# WA-WORLD 1.1 — Multiplayer Arena (Beta)

## Workflow
1. A dan B mengirim `.arena` pada DM bot (dua nomor WA berbeda).
2. A mengetik `.queue join snakes`; B mengetik perintah sama.
3. Masing-masing ketik `.match current` lalu `.match accept` (opsional pakai ID).
4. P1 lalu P2 bergantian `.match roll`; `.match board` mengirim PNG board.
5. `.match status`, `.match resign`, `.queue leave`.

## Batasan
- Game snake and ladders saat ini 2 pemain. Queue menghubungkan dua akun yang mendaftar sukarela, bukan scraping kontak.
- Belum ada push notification ke lawan. Gunakan `.queue status` atau `.match current`.
- Komponen lain: AI ML, chess engine, blackjack, tournament, item/inventory masih roadmap.
- No stakes/no topup/no cashout. No effect on V-Currency.
- Semua match disimpan pada SQLite, dadu `crypto.randomInt(1,7)`. Match pending timeout 5 menit; active timeout 24 jam sejak aksi terakhir.
- Privacy: hanya DM, hanya pemain yang dapat melihat match; tidak ada bocor nomor pada kartu papan.
- Kontrol tombol native didukung sebagai percobaan; fallback command tetap bisa digunakan.

## Tests
`npm test` dan `QA-ONE-CLICK.bat`, lalu uji wajib `LIVE_PAIR`, `LIVE_ROUNDTRIP`, `LIVE_MATCH`.
`LIVE_BOARD` merupakan tes opsional v1.1.
