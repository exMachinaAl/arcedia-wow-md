# WOW PvP Economy v1.8.0 — Ranked, Casual & V

## Definisi mode

- `Casual`: tidak mengubah rating Elo, tidak memberi V reward PvP. Tetap mencatat hasil di riwayat.
- `Ranked`: pencocokan hanya dengan pengguna mode sama; catur memengaruhi Elo jika minimal 8 ply; kemenangan sah bisa menerima V tanpa debit wallet lawan.
- **Catur Ranked**: kemenangan melalui CHECKMATE dengan >=8 ply: +12 V pemenang; resign, cancel, draw, timeout: 0 V.
- **Ular Tangga Ranked**: mencapai kotak 100 melalui gameplay normal: +8 V pemenang; resign, cancel, timeout: 0 V.
- **Blackjack Ranked**: label mode + statistik hasil; tidak ada V reward untuk hasil kartu (game acak) dan tidak ada taruhan.
- Pencocokan pemain berbeda mode dicegah; default lama dipertahankan (Chess Ranked, Snakes Casual, Blackjack Casual).

## Proteksi ekonomi

- Batas hadiah kompetitif maksimum **24 V per akun per hari WIB** dan **2 kemenangan berhadiah terhadap lawan sama/hari**. Setiap match diselesaikan maksimal satu kali, dalam transaksi SQLite yang sama dengan ledger dan wallet.
- Penyerahan pertandingan dan pertandingan yang dibatalkan tidak boleh menghasilkan V. Tidak ada biaya antre, taruhan V, escrow, top-up, cash-out, uang nyata, atau hadiah yang bisa diuangkan.
- `pvp_settlements` mencatat semua hasil (termasuk zero-reward), sementara `pvp_reward_claims` mencatat pembayaran yang sah dan `ledger` adalah catatan peningkatan saldo.
- Ini adalah proteksi awal, **bukan anti-collusion kuat**: multiakun serta kemenangan palsu perlu deteksi lanjutan dan audit sebelum dirilis ke publik.
- **Perhatian kebijakan**: karena V utama dapat ditransfer dalam fitur Social lama, perlu kajian hukum dan kebijakan platform sebelum membuka layanan publik dengan hadiah acak atau sistem transfer.

## Perintah WhatsApp

```
.pvp
.pvp mode chess casual
.pvp mode chess ranked
.pvp mode snakes ranked
.pvp mode blackjack casual
.pvp stats
.pvp history
.chess join casual
.chess join ranked
.queue join snakes casual
.queue join snakes ranked
.wow wallet
```

Perubahan mode ditolak saat ada antrean atau pertandingan aktif untuk game yang sama. Dua pemain harus memilih mode yang sama agar dipasangkan. Pergantian mode tidak mengubah mode pertandingan lama.

## Shutdown & upgrade

State pertandingan, mode match dan ledger tersimpan di SQLite; setelah restart dapat diteruskan. Hentikan gateway sebelum menginstal patch dan backup `data/` secara terpisah; source rollback **tidak** mengembalikan migrasi database atau transaksi setelah update. Uji live mode dan tombol tetap `PENDING_LIVE` sampai pemilik nomor mengonfirmasi.

## Backlog

1. Pelacakan matchmaking & rating musiman; leaderboard privat opt-in
2. Anti-kolusi (relasi perangkat/IP dengan persetujuan, statistik anomali, manual review), keamanan akun
3. ML recommendation hanya setelah sampel mencukupi, tidak memanipulasi RNG
4. Audit ekonomi, kontrol inflasi, kebijakan lokal, administrasi ekonomi
5. Perapihan pesan dan UI tombol untuk Ranked/Casual saat satu pemain join
