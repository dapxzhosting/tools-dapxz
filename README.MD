# Tools Dapxz

Aplikasi web all-in-one untuk **download video/audio dari berbagai platform** dan **konversi file** — semua dalam satu antarmuka, tanpa iklan, tanpa watermark.

**Live demo:** https://tools.dafaalfiansyah.my.id/

---

## ✨ Fitur

### Downloader
- **YouTube** — download video (pilih resolusi/format) atau ekstrak audio
- **TikTok** — download video tanpa watermark (MP4) atau audio (MP3)
- **Instagram** — download video/foto (post, reel, story/highlight)
- **Twitter / X** — download video dari tweet
- **CapCut Template** — download video template CapCut

### Converter
- **Image Converter** — konversi antar format gambar (PNG, JPG, WebP, dll)
- **Compress Image** — kompres ukuran gambar
- **MP4 ke MP3** — ekstrak audio dari file video
- **Background Remover** — hapus background gambar
- **Gambar ke PDF** — gabungkan beberapa gambar jadi satu PDF
- **PDF ke Gambar** — ekstrak halaman PDF jadi gambar
- **Kompres PDF** — perkecil ukuran file PDF

### Generator & Utilitas
- **QR Code Generator** — buat QR code kustom (warna, ukuran)
- **Font Generator** — preview teks dengan berbagai font kaligrafi
- **Signature Generator** — buat tanda tangan digital
- **Encode / Decode** — Base64, URL encoding, dll

### UI/UX
- Sidebar navigasi dua grup (Downloader & Converter)
- Dark/Light mode otomatis (`prefers-color-scheme`) + tersimpan di `localStorage`
- Splash screen saat pertama load
- Responsif & mobile-friendly

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Backend | Node.js, Express |
| Downloader engine | yt-dlp, Cobalt API (fallback) |
| Video processing | ffmpeg |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Konversi client-side | jsPDF, pdf.js, JSZip, qr-code-styling |
| Upload handling | Multer |
| Deployment | Docker, Nixpacks (Railway) |

---

## 📋 Prasyarat

Sebelum menjalankan secara lokal, pastikan sudah terpasang:

- **Node.js** ≥ 18
- **Python 3** (dibutuhkan oleh `yt-dlp`)
- **yt-dlp** — `pip install -U yt-dlp` atau `pip3 install --break-system-packages yt-dlp`
- **ffmpeg** — dibutuhkan untuk konversi video ke MP3 dan proses video lainnya
- **Git** (opsional, untuk clone)

> Kalau mau menjalankan fitur CapCut Template dengan mode browser (`CAPCUT_USE_BROWSER=true`), package `puppeteer` juga akan otomatis ter-install lewat `npm install`.

---

## 🚀 Cara Install & Menjalankan (Lokal)

1. **Clone repository**
   ```bash
   git clone https://github.com/dapxzhosting/tools-dapxz.git
   cd tools-dapxz
   ```

2. **Install dependency**
   ```bash
   npm install
   ```

3. **Buat file `.env`** di root project (lihat [Konfigurasi Environment Variable](#-konfigurasi-environment-variable) di bawah)
   ```bash
   PORT=3000
   COBALT_API_URL=http://localhost:9000
   COBALT_API_KEY=
   YTDLP_BIN=
   ```

4. **Pastikan `yt-dlp` dan `ffmpeg` bisa diakses dari terminal**
   ```bash
   yt-dlp --version
   ffmpeg -version
   ```

5. **Jalankan server**
   ```bash
   npm start
   ```

6. Buka browser ke `http://localhost:3000`

---

## ⚙️ Konfigurasi Environment Variable

| Variable | Wajib? | Default | Keterangan |
|---|---|---|---|
| `PORT` | Tidak | `3000` | Port server. Di Railway/hosting lain biasanya otomatis di-set. |
| `COBALT_API_URL` | Tidak | `https://api.cobalt.tools` | URL API [Cobalt](https://cobalt.tools) untuk downloader Instagram (fallback). Kosongkan untuk pakai instance publik, atau isi URL instance self-hosted (mis. `http://localhost:9000`). |
| `COBALT_API_KEY` | Kondisional | — | Wajib diisi **hanya** kalau memakai instance publik `https://api.cobalt.tools` (sekarang wajib API key). Kosongkan kalau self-host Cobalt sendiri. |
| `YTDLP_BIN` | Tidak | `yt-dlp` | Path custom ke binary `yt-dlp`. Kosongkan kalau `yt-dlp` sudah ada di `PATH` sistem. |
| `YT_COOKIES` | Tidak | — | Isi cookies YouTube (format Netscape atau JSON) untuk melewati deteksi "sign in to confirm you're not a bot" saat server berjalan di cloud/datacenter. |
| `IG_COOKIES_JSON` / `IG_COOKIES_PATH` | Tidak | `ig_cookies.json` | Cookie session Instagram untuk fitur download yang butuh login. |
| `CAPCUT_COOKIES` | Tidak | — | Cookie untuk request ke CapCut. |
| `CAPCUT_USE_BROWSER` | Tidak | `false` | Set `true` untuk render CapCut pakai Puppeteer (butuh Chromium, lebih berat tapi lebih akurat). |
| `CAPCUT_AUTO_CROP` | Tidak | `false` | Set `true` untuk otomatis crop letterbox/pillarbox hitam pada video CapCut hasil download. |

> ⚠️ **Jangan pernah commit file `.env` atau `ig_cookies.json` ke Git.** Keduanya sudah masuk `.gitignore` secara default.

---

## 📦 Deployment

### Docker

```bash
docker build -t tools-dapxz .
docker run -p 3000:3000 --env-file .env tools-dapxz
```

Dockerfile sudah menghandle instalasi `ffmpeg`, `yt-dlp`, dependency Puppeteer/Chromium, dan **Deno** (dibutuhkan `yt-dlp` untuk solve *n challenge* signature YouTube) serta **PO Token Provider** (server lokal di port `4416` yang membantu `yt-dlp` melewati deteksi bot YouTube).

### Railway (Nixpacks)

Project sudah menyertakan `nixpacks.toml`, cukup connect repo ke Railway:

```toml
[phases.setup]
nixPkgs = ["python3", "ffmpeg", "yt-dlp"]

[phases.install]
cmds = ["npm install"]

[start]
cmd = "npm start"
```

Set environment variable yang dibutuhkan (lihat tabel di atas) lewat dashboard Railway.

---

## 📡 API Endpoint (ringkas)

| Method | Endpoint | Keterangan |
|---|---|---|
| `GET` | `/api/info?url=` | Ambil info video YouTube (judul, thumbnail, daftar format) |
| `GET` | `/api/download?url=&formatId=&hasAudio=` | Download video/audio YouTube sesuai format |
| `GET` | `/api/social/proxy-thumbnail` | Proxy thumbnail (menghindari masalah CORS/hotlink) |
| `POST` | `/api/social/info` | Ambil info postingan (TikTok/Instagram/Twitter) |
| `POST` | `/api/social/download` | Download video dari TikTok/Instagram/Twitter |
| `POST` | `/api/social/download-mp3` | Download & convert ke MP3 |
| `POST` | `/api/social/download-images` | Download foto/carousel dari postingan |
| `POST` | `/api/convert/mp4-to-mp3` | Upload file MP4, convert ke MP3 (via ffmpeg) |
| `POST` | `/api/capcut/info` | Ambil info template CapCut |
| `POST` | `/api/capcut/download` | Download video template CapCut |

---

## 🩺 Troubleshooting

**1. Error `yt-dlp: command not found` / download YouTube gagal total**
- Pastikan `yt-dlp` ter-install: `pip install -U yt-dlp`
- Kalau `yt-dlp` tidak ada di `PATH`, set `YTDLP_BIN` di `.env` dengan path lengkap, contoh: `YTDLP_BIN=/usr/local/bin/yt-dlp`

**2. YouTube error "Sign in to confirm you're not a bot"**
- Ini terjadi karena server berjalan dari IP cloud/datacenter yang dicurigai YouTube. Solusinya:
  - Isi `YT_COOKIES` di `.env` dengan cookies YouTube (export dari browser pakai extension seperti "Get cookies.txt")
  - Pastikan Deno + PO Token Provider berjalan (otomatis terpasang lewat Dockerfile — kalau jalan manual di lokal tanpa Docker, format video mungkin terbatas tanpa ini)

**3. Banyak format video/audio hilang, cuma tersisa video kualitas rendah atau gambar saja**
- Kemungkinan `yt-dlp` gagal solve *n challenge* signature YouTube. Pastikan **Deno** ter-install (lihat langkah di Dockerfile) — tanpa ini yt-dlp skip proses solving dan banyak format hilang.

**4. Konversi MP3/video gagal, error terkait `ffmpeg`**
- Pastikan `ffmpeg` ter-install dan bisa diakses dari terminal (`ffmpeg -version`). Kalau di Docker, sudah otomatis ter-install lewat `apt-get`.

**5. Download Instagram gagal / butuh login**
- Beberapa konten Instagram (private, story, highlight) butuh cookie session. Isi `IG_COOKIES_JSON` (format JSON) atau taruh file cookie di path `IG_COOKIES_PATH` (default `ig_cookies.json` di root project).
- Kalau pakai fallback Cobalt API publik, pastikan `COBALT_API_KEY` sudah diisi — instance publik sekarang wajib API key.

**6. Error dari Cobalt API: "gagal ambil data" / ditolak instance publik**
- Instance publik `api.cobalt.tools` punya proteksi bot yang cukup ketat untuk request non-browser. Solusi:
  - Self-host Cobalt sendiri via Docker, lalu isi `COBALT_API_URL` ke URL instance kamu, kosongkan `COBALT_API_KEY`
  - Atau pastikan `COBALT_API_KEY` valid kalau tetap pakai instance publik

**7. Background Remover / fitur berbasis WASM terasa lambat**
- Pastikan browser mendukung `SharedArrayBuffer` (butuh header cross-origin isolation yang sudah di-set otomatis oleh server). Kalau masih lambat, kemungkinan CDN pihak ketiga (jsDelivr dkk) yang dipakai untuk resource WASM sedang lambat di jaringan kamu.

**8. Upload MP4 ke MP3 gagal, file terlalu besar**
- Batas upload untuk konversi MP4 ke MP3 adalah **300MB per file**. File di atas itu akan ditolak.

**9. CapCut Template gagal didownload / hasil video kosong**
- Coba aktifkan `CAPCUT_USE_BROWSER=true` di `.env` (butuh `puppeteer` ter-install: `npm install puppeteer`) agar halaman di-render pakai browser headless, lebih akurat untuk halaman yang butuh JavaScript.
- Kalau video hasil download ada bar hitam (letterbox/pillarbox) yang mengandung watermark, aktifkan `CAPCUT_AUTO_CROP=true` untuk auto-crop.

**10. Server jalan tapi endpoint API selalu error 500**
- Cek log terminal — hampir semua error di endpoint social/downloader di-log dengan prefix jelas (`[social/info/...]`, `[capcut]`, dll) yang menunjukkan tahap mana yang gagal (misal fallback dari Cobalt ke yt-dlp).

---

## 📁 Struktur Project

```
.
├── public/
│   ├── index.html      # Halaman utama (semua tool dalam satu halaman)
│   ├── script.js        # Logika frontend (semua tab downloader/converter/generator)
│   └── style.css        # Styling, tema dark/light, responsif
├── server.js             # Backend Express — semua endpoint API
├── start.sh              # Script startup (jalankan PO token provider + server)
├── DockerFile             # Setup image Docker (ffmpeg, yt-dlp, Deno, Puppeteer deps)
├── nixpacks.toml         # Konfigurasi build untuk Railway
├── package.json
└── .env                   # Environment variable (jangan di-commit)
```

---

## 🤝 Kontribusi

Pull request terbuka untuk siapa saja. Untuk perubahan besar, buka issue dulu untuk didiskusikan.

## 📄 Lisensi

ISC — bebas digunakan, dimodifikasi, dan disebarluaskan.

## 👤 Author

**Dafa Alfiansyah**
- GitHub: [@dapxzhosting](https://github.com/dapxzhosting)
- Instagram: [@dafa_alf1](https://instagram.com/dafa_alf1)
- Email: dafaalfiansyahdev@outlook.com
