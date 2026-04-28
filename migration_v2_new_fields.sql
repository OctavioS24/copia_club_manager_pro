-- Ejecutar estos comandos en el SQL Editor de Supabase para actualizar la estructura de la base de datos

-- 1. Agregar campo 'additional_fields' a la tabla de configuración de disciplinas
ALTER TABLE public.discipline_config 
ADD COLUMN IF NOT EXISTS "additional_fields" JSONB DEFAULT '[]'::jsonb;

-- 2. Actualizar la tabla de eventos de partido con nuevos campos de alcance y puntuación
ALTER TABLE public.match_events 
ADD COLUMN IF NOT EXISTS "is_rival" BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS "player_name" TEXT,
ADD COLUMN IF NOT EXISTS "additional_data" JSONB DEFAULT '{}'::jsonb;

-- Nota: No es necesario alterar las columnas JSONB existentes (event_types), 
-- ya que aceptan cualquier estructura de objeto nueva automáticamente.
