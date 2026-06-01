-- Ejecutar estos comandos en el SQL Editor de Supabase
-- para habilitar registros independientes de asistencia por categoría.

-- 1. Agregar la columna category_id a la tabla 'attendance' si no existe
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS category_id VARCHAR(255) DEFAULT '';

-- 2. Eliminar la restricción de unicidad anterior sobre (player_id, date, discipline)
-- De esta manera, el sistema podrá admitir múltiples asistencias de un mismo atleta un mismo día en categorías diferentes.
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_player_id_date_discipline_key;

-- 3. Si tienes un índice único en lugar de un constraint, lo eliminamos también por seguridad
DROP INDEX IF EXISTS public.attendance_player_id_date_discipline_idx;

-- 4. Crear la nueva restricción de unicidad de cuatro columnas (player_id, date, discipline, category_id)
ALTER TABLE public.attendance 
DROP CONSTRAINT IF EXISTS attendance_player_date_discipline_category_key;

ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_player_date_discipline_category_key 
UNIQUE (player_id, date, discipline, category_id);

-- Comentario sobre el uso de la columna
COMMENT ON COLUMN public.attendance.category_id IS 'ID de la categoría a la que corresponde la sesión de asistencia tomada';
