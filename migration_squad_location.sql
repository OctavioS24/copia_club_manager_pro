-- Ejecutar este comando en la consola de Supabase (SQL Editor)
-- para habilitar la ubicación específica de cada partido en la convocatoria (match_squads).

ALTER TABLE public.match_squads 
ADD COLUMN IF NOT EXISTS location TEXT;

-- Comentario explicativo opcional sobre la nueva columna
COMMENT ON COLUMN public.match_squads.location IS 'Ubicación o enlace de Google Maps específico de la sede/cancha para esta convocatoria/partido';
