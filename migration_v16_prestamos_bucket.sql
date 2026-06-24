-- =========================================================================
-- MIGRACIÓN DE BD V16: CREACIÓN DE BUCKET 'prestamos' Y COLUMNAS CONTRACTUALES
-- =========================================================================

-- 1. CREACIÓN DEL BUCKET 'prestamos' EN STORAGE PARA ARCHIVOS DE PRÉSTAMO
INSERT INTO storage.buckets (id, name, public)
VALUES ('prestamos', 'prestamos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. POLÍTICAS DE ACCESO PARA EL BUCKET 'prestamos' (LECTURA PÚBLICA)
DROP POLICY IF EXISTS "Public Access para lectura en prestamos" ON storage.objects;
CREATE POLICY "Public Access para lectura en prestamos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'prestamos');

-- 3. POLÍTICAS DE INSERCIÓN PARA EL BUCKET 'prestamos'
DROP POLICY IF EXISTS "Public Access para inserción en prestamos" ON storage.objects;
CREATE POLICY "Public Access para inserción en prestamos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'prestamos');

-- 4. POLÍTICAS DE ELIMINACIÓN PARA EL BUCKET 'prestamos'
DROP POLICY IF EXISTS "Public Access para eliminación en prestamos" ON storage.objects;
CREATE POLICY "Public Access para eliminación en prestamos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'prestamos');

-- 5. AGREGAR COLUMNAS PARA LA SITUACIÓN CONTRACTUAL EN LA TABLA 'members'
ALTER TABLE public.members 
ADD COLUMN IF NOT EXISTS contract_condition TEXT DEFAULT 'Propio',
ADD COLUMN IF NOT EXISTS contract_loan_club TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS contract_loan_from DATE,
ADD COLUMN IF NOT EXISTS contract_loan_to DATE,
ADD COLUMN IF NOT EXISTS contract_loan_attachment_url TEXT DEFAULT '';
