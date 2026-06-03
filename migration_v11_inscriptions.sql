-- ====================================================================
-- MIGRACIÓN BASE DE DATOS: CONFIGURACIÓN DE INSCRIPCIONES (MATRÍCULAS)
-- Ejecutar esta consulta en el editor SQL de Supabase (Cuenta B de producción)
-- ====================================================================

-- 1. Crear la tabla de configuración de inscripciones si no existe
CREATE TABLE IF NOT EXISTS public.inscription_configs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL,
  due_date text NOT NULL,
  category_ids jsonb DEFAULT '[]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT inscription_configs_pkey PRIMARY KEY (id)
);

-- 2. Asegurar que Row Level Security (RLS) esté ACTIVADO
ALTER TABLE public.inscription_configs ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas RLS permisivas para acceso general de lectura y escritura
-- Esto permitirá que la app (con su cliente Supabase) pueda consultar, insertar, actualizar y borrar configuraciones.

-- Eliminar políticas previas si existen
DROP POLICY IF EXISTS "Allow all public access for inscription_configs" ON public.inscription_configs;

-- Crear política general para select, insert, update y delete
CREATE POLICY "Allow all public access for inscription_configs" 
ON public.inscription_configs 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. Asegurar que los roles tengan permisos básicos sobre la tabla
GRANT ALL ON public.inscription_configs TO postgres;
GRANT ALL ON public.inscription_configs TO anon;
GRANT ALL ON public.inscription_configs TO authenticated;
GRANT ALL ON public.inscription_configs TO service_role;
