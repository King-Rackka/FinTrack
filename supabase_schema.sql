-- ════════════════════════════════════════
-- FINTRACK KIP — Supabase SQL Schema v3
-- Update: Fitur Dompet (multi-wallet)
-- Jalankan ini di Supabase SQL Editor
-- ════════════════════════════════════════

-- Tabel Dompet (buat dulu karena direferensikan tabel lain)
CREATE TABLE IF NOT EXISTS dompet (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama           TEXT NOT NULL,
  emoji          TEXT NOT NULL DEFAULT '💰',
  saldo_awal     NUMERIC(15,0) NOT NULL DEFAULT 0,
  budget_bulanan NUMERIC(15,0),
  warna          TEXT DEFAULT 'blue',
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Tabel Pemasukan
CREATE TABLE IF NOT EXISTS pemasukan (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal    DATE NOT NULL,
  sumber     TEXT NOT NULL,
  nominal    NUMERIC(15,0) NOT NULL DEFAULT 0,
  catatan    TEXT,
  dompet_id  UUID REFERENCES dompet(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel Pengeluaran
CREATE TABLE IF NOT EXISTS pengeluaran (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal    DATE NOT NULL,
  deskripsi  TEXT NOT NULL,
  kategori   TEXT NOT NULL,
  nominal    NUMERIC(15,0) NOT NULL DEFAULT 0,
  catatan    TEXT,
  dompet_id  UUID REFERENCES dompet(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel Transfer antar Dompet
CREATE TABLE IF NOT EXISTS transfer (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tanggal      DATE NOT NULL,
  dari_dompet  UUID NOT NULL REFERENCES dompet(id) ON DELETE CASCADE,
  ke_dompet    UUID NOT NULL REFERENCES dompet(id) ON DELETE CASCADE,
  nominal      NUMERIC(15,0) NOT NULL DEFAULT 0,
  catatan      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Tabel Goals
CREATE TABLE IF NOT EXISTS goals (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama       TEXT NOT NULL,
  target     NUMERIC(15,0) NOT NULL DEFAULT 0,
  terkumpul  NUMERIC(15,0) NOT NULL DEFAULT 0,
  deadline   DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabel Tagihan Rutin
CREATE TABLE IF NOT EXISTS tagihan (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama           TEXT NOT NULL,
  nominal        NUMERIC(15,0) NOT NULL DEFAULT 0,
  kategori       TEXT NOT NULL,
  tanggal_jatuh  INTEGER NOT NULL CHECK (tanggal_jatuh BETWEEN 1 AND 28),
  sudah_bayar    BOOLEAN NOT NULL DEFAULT false,
  bulan_bayar    TEXT,
  dompet_id      UUID REFERENCES dompet(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Tabel Kategori Custom
CREATE TABLE IF NOT EXISTS kategori_custom (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nama       TEXT NOT NULL UNIQUE,
  emoji      TEXT NOT NULL DEFAULT '🔖',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════
-- Seed Data Default
-- ════════════════════════════════════════

INSERT INTO dompet (nama, emoji, saldo_awal, warna) VALUES
  ('Cash',  '💵', 0, 'green'),
  ('GoPay', '🟢', 0, 'teal'),
  ('BCA',   '🏦', 0, 'blue')
ON CONFLICT DO NOTHING;

INSERT INTO kategori_custom (nama, emoji) VALUES
  ('Makan',     '🍚'),
  ('Transport', '🚌'),
  ('Kuliah',    '📚'),
  ('Kos',       '🏠'),
  ('Pulsa',     '📱'),
  ('Hiburan',   '🎮'),
  ('Pakaian',   '👕'),
  ('Kesehatan', '💊'),
  ('Lainnya',   '🔧')
ON CONFLICT (nama) DO NOTHING;

-- ════════════════════════════════════════
-- Row Level Security (RLS)
-- ════════════════════════════════════════

ALTER TABLE dompet          ENABLE ROW LEVEL SECURITY;
ALTER TABLE pemasukan       ENABLE ROW LEVEL SECURITY;
ALTER TABLE pengeluaran     ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer        ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tagihan         ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategori_custom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_dompet"          ON dompet           FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pemasukan"       ON pemasukan        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_pengeluaran"     ON pengeluaran      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transfer"        ON transfer         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_goals"           ON goals            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_tagihan"         ON tagihan          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_kategori_custom" ON kategori_custom  FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════
-- MIGRASI (jika sudah punya data lama)
-- Uncomment dan jalankan secara terpisah
-- ════════════════════════════════════════
-- ALTER TABLE pemasukan   ADD COLUMN IF NOT EXISTS dompet_id UUID REFERENCES dompet(id) ON DELETE SET NULL;
-- ALTER TABLE pengeluaran ADD COLUMN IF NOT EXISTS dompet_id UUID REFERENCES dompet(id) ON DELETE SET NULL;
-- ALTER TABLE tagihan     ADD COLUMN IF NOT EXISTS dompet_id UUID REFERENCES dompet(id) ON DELETE SET NULL;
-- DROP TABLE IF EXISTS budget;
