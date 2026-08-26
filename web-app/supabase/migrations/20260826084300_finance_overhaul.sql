-- Migration untuk Perombakan Sistem Finance (Payment Workflow v2)

-- 1. Update constraint role di tabel profiles
-- Role baru: executive, finance (hierarchy: executive > finance > manager > anggota)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('executive', 'finance', 'manager', 'anggota'));

-- 2. Buat tabel creator_bank_accounts
CREATE TABLE IF NOT EXISTS creator_bank_accounts (
  id SERIAL PRIMARY KEY,
  creator_id INT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,           -- BCA, DANA, ShopeePay, dll
  account_number TEXT NOT NULL,      -- Nomor rekening/VA
  account_holder TEXT NOT NULL,      -- Nama pemilik rekening
  is_primary BOOLEAN DEFAULT FALSE,
  added_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(creator_id, bank_name, account_number)
);

-- 3. Buat tabel sender_accounts
CREATE TABLE IF NOT EXISTS sender_accounts (
  id SERIAL PRIMARY KEY,
  nama TEXT NOT NULL UNIQUE,         -- PT TNT, dll
  added_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data awal untuk sender_accounts
INSERT INTO sender_accounts (nama) VALUES ('PT TNT') ON CONFLICT (nama) DO NOTHING;

-- 4. Buat tabel payment_batches
CREATE TABLE IF NOT EXISTS payment_batches (
  id SERIAL PRIMARY KEY,
  campaign_id INT NOT NULL REFERENCES campaigns(id),
  batch_label TEXT,
  
  -- PIC yang submit
  submitted_by UUID REFERENCES public.profiles(id),
  submitted_at TIMESTAMPTZ,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',              -- PIC masih mengisi form
    'pending_manager',    -- Menunggu Approval Manager
    'pending_finance',    -- Menunggu Review Finance
    'pending_executive',  -- Menunggu Approval Executive
    'ready_to_pay',       -- Executive sudah approve, siap ditransfer
    'paid',               -- Sudah dibayar
    'cancelled'           -- Dibatalkan
  )),
  
  -- Timestamps dan Actor untuk setiap tahap
  manager_reviewed_by UUID REFERENCES public.profiles(id),
  manager_reviewed_at TIMESTAMPTZ,
  
  finance_reviewed_by UUID REFERENCES public.profiles(id),
  finance_reviewed_at TIMESTAMPTZ,
  
  executive_reviewed_by UUID REFERENCES public.profiles(id),
  executive_reviewed_at TIMESTAMPTZ,
  
  paid_by UUID REFERENCES public.profiles(id),
  paid_at TIMESTAMPTZ,
  
  actual_payment_date DATE,
  bukti_transfer_url TEXT,
  sender_account_id INT REFERENCES sender_accounts(id),
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Buat tabel payment_items
CREATE TABLE IF NOT EXISTS payment_items (
  id SERIAL PRIMARY KEY,
  batch_id INT NOT NULL REFERENCES payment_batches(id) ON DELETE CASCADE,
  campaign_creator_id INT NOT NULL REFERENCES campaign_creators(id),
  
  -- Tipe pembayaran
  payment_type TEXT NOT NULL CHECK (payment_type IN (
    '100_akhir',
    '50_awal',
    '50_akhir',
    'ads',
    'crm',
    'lion',
    'reward_affiliate',
    'boost_views',
    'boost_comment'
  )),
  
  -- Nominal
  ratecard_awal BIGINT,
  nominal BIGINT NOT NULL,
  biaya_transfer BIGINT DEFAULT 0,
  
  -- Rekening kreator
  bank_account_id INT REFERENCES creator_bank_accounts(id),
  metode_pembayaran TEXT,
  nomor_rekening TEXT,
  nama_penerima TEXT,
  
  -- Kontak WA
  nama_wa_pic TEXT,
  nomor_wa_dealing TEXT,
  
  -- Administrasi
  alamat_ktp TEXT,
  nik TEXT,
  link_ktp TEXT,
  link_kontrak TEXT,
  
  -- Approval tracking per kreator
  manager_status TEXT NOT NULL DEFAULT 'pending' CHECK (manager_status IN ('pending', 'approved', 'rejected')),
  manager_note TEXT,
  manager_acted_by UUID REFERENCES public.profiles(id),
  manager_acted_at TIMESTAMPTZ,
  
  finance_selected BOOLEAN DEFAULT FALSE,
  
  executive_status TEXT NOT NULL DEFAULT 'pending' CHECK (executive_status IN ('pending', 'approved', 'rejected')),
  executive_note TEXT,
  executive_acted_by UUID REFERENCES public.profiles(id),
  executive_acted_at TIMESTAMPTZ,
  
  -- Final status
  final_status TEXT NOT NULL DEFAULT 'pending' CHECK (final_status IN (
    'pending',
    'manager_approved',
    'finance_selected',
    'exec_approved',
    'paid',
    'rejected'
  )),
  
  created_at TIMESTAMPTZ DEFAULT now()
);
