-- MIGRACIÓN DE BD V14: CREACIÓN DE BUCKET 'files' PARA ACCESO GENERAL DE COMPROBANTES Y PAGOS
-- Ejecutar estos comandos en el SQL Editor de Supabase para asegurar que el bucket exista y tenga políticas correctas.

-- 1. Crear el bucket 'files' si no existe
INSERT INTO storage.buckets (id, name, public)
VALUES ('files', 'files', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Crear políticas para permitir acceso público al bucket 'files'
DROP POLICY IF EXISTS "Public Access para lectura en files" ON storage.objects;
CREATE POLICY "Public Access para lectura en files" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'files');

DROP POLICY IF EXISTS "Public Access para inserción en files" ON storage.objects;
CREATE POLICY "Public Access para inserción en files" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'files');

DROP POLICY IF EXISTS "Public Access para eliminación en files" ON storage.objects;
CREATE POLICY "Public Access para eliminación en files" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'files');
