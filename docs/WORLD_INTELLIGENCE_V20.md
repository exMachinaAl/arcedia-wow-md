# WOW v2.0 — World Intelligence & Player Statistics

## Ringkasan
v2.0 menambahkan event dunia harian, reward ekspedisi sekali per hari, player card teks dan PNG, statistik server agregat, dan rekomendasi kategori berbasis pembelajaran online opt-in. Tidak ada tambahan permainan ke angka 54/100. Konten tidak memerlukan API berbayar.

## Perintah
- `.world event` — event dunia harian dan reward ekspedisi yang tersedia.
- `.world quest` — klaim 1 ekspedisi gratis/hari WIB, reward 6–10 V tergantung event. Ini kegiatan simulasi sederhana; misi berbasis progres mendalam baru backlog.
- `.world audit` — bukti deterministik berupa tanggal, nilai hasil HMAC, dan hash komitmen seed server. Secret tidak dibagikan kepada pemain.
- `.stats` atau `.stats card` — profil pribadi; `card` mengirim PNG 640x350 bila WhatsApp image handler aktif.
- `.stats world` — statistik total pemain, jumlah ronde, saldo V, mining, dan aktivitas agregat; tanpa nomor telepon.
- `.smart on` — izin belajar dari kategori penggunaan game/fitur, bukan isi chat.
- `.smart recommend` — rekomendasi aktivitas berdasarkan probabilitas preferensi (posterior Beta smoothed mean) + eksplorasi UCB + jumlah penggunaan.
- `.smart like mining` / `.smart skip mining` — feedback positif/negatif; kategori: mining, career, crafting, market, pvp, arcade.
- `.smart off` — nonaktif dan hapus sinyal, jejak event, dan cache preferensi.
- `.smart status` — status consent dan total sinyal.

## Apa yang ML lakukan dan tidak lakukan
**Dilakukan:** sistem pembelajaran online memperbarui skor preferensi dari respons pengguna dan tindakan kategori sesudah opt-in. Rekomendasi bergerak seiring data. Ini model statistik pembelajaran ringan, bukan neural network, classifier outcome, atau LLM. Model belum divalidasi melalui eksperimen jangka panjang pada pemain sungguhan.

**Dilarang:** mengubah hasil dadu, slot, gacha, Blackjack, Risk Room, Elo, atau harga pasar berdasarkan status kekayaan individu. RNG game independen dari event dunia/ML.

## Data, restart dan keamanan
- `wow_world_seed` dibangkitkan crypto sekali pada database dan digunakan HMAC per tanggal WIB; tabel event harian memastikan tanggal yang sudah dicatat tidak berubah meskipun restart.
- Satu klaim ekspedisi per `user_id/day`, `event_key` unik dan transaksi atomik melalui Core.
- Pilihan machine learning opt-in dan private by default. Tidak menyimpan isi percakapan untuk model.
- `.stats card` tidak diizinkan di grup. Aggregate `/api/v1/world` tersedia pada dashboard yang default bind `127.0.0.1`; jangan mengeksposnya tanpa autentikasi di produksi.
- Larangan transfer V, top-up, cash-out tetap dijaga oleh sistem v1.9.
- Snapshot/backup database `data/` tetap tanggung jawab operator sebelum upgrade. Source rollback tidak mengembalikan migrasi DB (migrasi tambahan bersifat aditif).

## Batas versi
Belum mengimplementasikan guild, properti, lelang escrow, daily shop, image art profesional, anti-farming multiakun, atau optimisasi ML global. Status WhatsApp live tetap `PENDING` hingga ada laporan pemilik nomor.
