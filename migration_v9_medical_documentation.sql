-- Ejecutar estos comandos en el SQL Editor de Supabase para agregar la tabla de documentación médica y configurar el almacenamiento.

-- 1. Crear la tabla para la documentación médica
CREATE TABLE IF NOT EXISTS public.medical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    section TEXT NOT NULL, -- 'procedures' (Procedimientos), 'templates' (Planillas), 'reports' (Informes de Liga)
    attachments JSONB DEFAULT '[]'::jsonb NOT NULL, -- JSON de archivos adjuntos: [{"name": "archivo.pdf", "url": "https://..."}]
    uploaded_by TEXT NOT NULL, -- Quién lo carga
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE public.medical_documents ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso público total en la tabla de documentos
DROP POLICY IF EXISTS "Allow all public access for medical_documents" ON public.medical_documents;
CREATE POLICY "Allow all public access for medical_documents" 
ON public.medical_documents FOR ALL USING (true);


-- 2. Asegurar que el bucket de almacenamiento exista en Supabase
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical_attachments', 'medical_attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Crear políticas para permitir acceso público al bucket 'medical_attachments' si no existen
DROP POLICY IF EXISTS "Public Access para lectura en medical_attachments" ON storage.objects;
CREATE POLICY "Public Access para lectura en medical_attachments" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'medical_attachments');

DROP POLICY IF EXISTS "Public Access para inserción en medical_attachments" ON storage.objects;
CREATE POLICY "Public Access para inserción en medical_attachments" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'medical_attachments');

DROP POLICY IF EXISTS "Public Access para eliminación en medical_attachments" ON storage.objects;
CREATE POLICY "Public Access para eliminación en medical_attachments" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'medical_attachments');
