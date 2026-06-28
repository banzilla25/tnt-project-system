-- Mengaktifkan RLS untuk semua tabel dalam schema public

DO $$
DECLARE
    row record;
BEGIN
    FOR row IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    LOOP
        -- Enable RLS
        EXECUTE 'ALTER TABLE public.' || quote_ident(row.tablename) || ' ENABLE ROW LEVEL SECURITY;';
        
        -- Hapus policy yang mungkin sudah ada agar tidak error duplikat
        BEGIN
            EXECUTE 'DROP POLICY IF EXISTS "Enable full access for authenticated users" ON public.' || quote_ident(row.tablename) || ';';
        EXCEPTION WHEN undefined_object THEN
            NULL;
        END;
        
        -- Buat policy yang hanya mengizinkan user dengan role 'authenticated'
        EXECUTE 'CREATE POLICY "Enable full access for authenticated users" ON public.' || quote_ident(row.tablename) || ' AS PERMISSIVE FOR ALL TO authenticated USING (true) WITH CHECK (true);';
    END LOOP;
END;
$$;
