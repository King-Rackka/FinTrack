# 💰 FinTrack KIP — Panduan Instalasi Lengkap

## 📁 Struktur File
```
fintrack-kip/
├── index.html              ← Halaman utama
├── css/
│   └── style.css           ← Styling dark mode + responsive
├── js/
│   ├── supabase.js         ← Koneksi Supabase & navigasi
│   ├── transaksi.js        ← Pemasukan & pengeluaran
│   ├── budget.js           ← Budget bulanan
│   ├── goals.js            ← Goals tabungan
│   └── dashboard.js        ← Dashboard & grafik
└── supabase_schema.sql     ← SQL untuk buat tabel di Supabase
```

---

## 🚀 Langkah Setup (Step by Step)

### STEP 1 — Daftar Supabase (GRATIS)
1. Buka **https://supabase.com**
2. Klik **"Start your project"**
3. Login pakai **GitHub** (lebih cepat) atau email
4. Klik **"New Project"**
5. Isi:
   - **Name:** fintrack-kip
   - **Database Password:** buat password (simpan!)
   - **Region:** pilih **Southeast Asia (Singapore)** — paling deket Indonesia
6. Klik **"Create new project"** → tunggu ~2 menit

---

### STEP 2 — Buat Tabel Database
1. Di dashboard Supabase, klik **"SQL Editor"** (ikon di sidebar kiri)
2. Klik **"New query"**
3. Copy-paste seluruh isi file **`supabase_schema.sql`**
4. Klik tombol **"Run"** (atau Ctrl+Enter)
5. Pastikan muncul pesan **"Success"**

---

### STEP 3 — Ambil API Key
1. Di Supabase, klik **"Project Settings"** (ikon gear di sidebar)
2. Klik **"API"**
3. Copy dua hal ini:
   - **Project URL** → contoh: `https://abcdefgh.supabase.co`
   - **anon public key** → string panjang yang dimulai dari `eyJ...`

---

### STEP 4 — Masukkan Key ke Code
1. Buka file **`js/supabase.js`**
2. Ganti baris ini:
```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';
```
Jadi seperti ini (contoh):
```javascript
const SUPABASE_URL = 'https://abcdefgh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

### STEP 5 — Jalankan Website
**Cara 1 — Lokal (tanpa hosting):**
- Langsung buka file `index.html` di browser

> ⚠️ Catatan: Karena menggunakan fetch ke Supabase, sebaiknya jalankan via server lokal.
> Instal **VS Code** + extension **Live Server**, lalu klik "Go Live"

**Cara 2 — Deploy ke Netlify (GRATIS & online):**
1. Buka **https://netlify.com** → daftar gratis
2. Drag & drop folder `fintrack-kip` ke dashboard Netlify
3. Website langsung online dengan URL seperti `fintrack-kip.netlify.app`
4. Bisa diakses dari HP manapun!

**Cara 3 — GitHub Pages:**
1. Upload folder ke GitHub repository
2. Aktifkan GitHub Pages di Settings
3. Website online di `username.github.io/fintrack-kip`

---

## 📱 Responsif
- **Mobile** (< 768px): Bottom navigation bar, layout 1 kolom
- **Tablet** (768–1024px): Layout 2 kolom, sidebar tersembunyi
- **Desktop** (> 1024px): Sidebar penuh, layout grid

---

## 🛠️ Troubleshooting

| Masalah | Solusi |
|---|---|
| Data tidak tersimpan | Cek SUPABASE_URL dan ANON_KEY di supabase.js |
| Tabel tidak ada | Jalankan ulang supabase_schema.sql di SQL Editor |
| CORS error | Pastikan buka via Live Server, bukan file:// langsung |
| Grafik tidak muncul | Cek koneksi internet (Chart.js dari CDN) |

---

## 🎨 Tech Stack
- **Frontend:** HTML5 + CSS3 + Vanilla JavaScript
- **Database:** PostgreSQL via Supabase
- **Charts:** Chart.js
- **Fonts:** Syne + Plus Jakarta Sans (Google Fonts)
- **Hosting:** Netlify / GitHub Pages (gratis)

---

## 📊 Fitur
- ✅ Dashboard dengan ringkasan & 2 grafik
- ✅ Input & riwayat pemasukan (KIP, freelance, dll)
- ✅ Input & riwayat pengeluaran per kategori
- ✅ Budget bulanan vs realisasi + warning
- ✅ Goals tabungan dengan progress bar
- ✅ Filter berdasarkan bulan
- ✅ Dark mode
- ✅ Responsive (mobile, tablet, desktop)
- ✅ Data tersimpan online di Supabase (PostgreSQL)
