# WOW v3.2 — Chat Cosmetics & Group Buttons Investigation

## Added
- `.chatstyle preset save NAMA` (maksimal 5), `.chatstyle preset use NAMA`, `.chatstyle preset list`, `.chatstyle preset off`, `.chatstyle preset remove NAMA` (DM). Preset hanya memakai item yang memang sedang/masih dimiliki.
- `.chatstyle preview`, `.chatstyle stats` termasuk guild tag dari keanggotaan saat ini; username/mention tetap teratribusi ke pengirim asli.
- Antrean v3.1, anti-loop, backpressure dan safe replace dipertahankan; tidak ada penghapusan chat secara default.
- `.groupbuttons status|probe|selector` hanya admin grup; `.groupbuttons report shown|hidden|clicked` untuk pengujian dari ponsel. ENV `WOW_GROUP_BUTTONS_PROBE=false` (default); tombol grup tidak dikirim otomatis ke setiap pemain.
- Native quick reply 3 tombol vs native single-select. Keduanya mencoba relay; pesan mengandung fallback perintah teks, dan hanya live client yang bisa membuktikan render.

## Known bug TRACKED: GROUP_INTERACTIVE_BUTTONS_NOT_VISIBLE (P0)
Laporan pemilik: button di grup sama sekali tidak tersedia; repo lama pernah menggunakan multi-button dan selector. Penyebab awal pada source v3.1: `src/wa/handler.js` menolak `.buttons` dalam grup dan hanya mengirim panel native untuk DM. Selain itu rendering proto bergantung pada Baileys/versi WhatsApp.

Referensi investigasi, bukan klaim kompatibilitas: https://github.com/KING-DAVIDX/btn-baileys (relay additionalNodes), https://github.com/onxlmao/Baileys-Premod (deep wrapper detection dan group metadata), https://github.com/WhiskeySockets/Baileys. Jangan mengganti fork saat upgrade tanpa security review.

### Rencana lanjutan
1. Jalankan probe sekali di grup uji, tes quick reply dan selector dari Android/iOS/Web berbeda; rekam feedback yang tampak nyata, bukan hanya status relay.
2. Bandingkan payload dan additionalNodes repo lama milik owner dengan `nativePayload` / `nativeRelayNodes`, cek wrapper `viewOnce`, receipt, serta parse `interactiveResponseMessage` dan `listResponseMessage`.
3. Tambahkan compatibility adapter dengan feature flags per group/version, fallback menu teks selalu tersedia.
4. QA live sebelum enable UI tombol untuk semua grup; tombol pilihan privat yang bisa membocorkan saldo harus tetap hanya melalui DM.

## Instalasi
- Patch hanya dari v3.1.0. Cadangkan folder data sebelum installer.
- `config/ENV_V32_EXAMPLE.env.txt` baru disertakan. Tambahkan `WOW_GROUP_BUTTONS_PROBE=true` ke `.env` lama hanya untuk percobaan. Restart bot.
- Admin grup: `.groupbuttons status`, `.groupbuttons probe`, `.groupbuttons selector`. Anggota: `.groupbuttons report hidden` bila tombol tidak terlihat.
- `.wowchat mode mirror` adalah pilihan aman jika Replace belum diuji live.
