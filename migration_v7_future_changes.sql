-- =========================================================================
-- MIGRACIÓN V7: REGISTRO DE CAMBIOS FUTUROS Y REESTABLECIMIENTO DE UNICIDAD
-- =========================================================================
-- Este archivo sirve para registrar todos los cambios incrementales y futuras
-- modificaciones en la base de datos de Supabase.
--
-- NOTA DE COMPATIBILIDAD:
-- La base de datos actual se encuentra completamente limpia y sincronizada
-- con la estructura y lógica de la aplicación React.
--
-- CONTROL DE CAMBIOS:
-- 1. Restaurar restricción de unicidad en la tabla 'attendance':
--    Dado que se eliminó la columna 'category_id' de 'attendance', debemos
--    restablecer la restricción UNIQUE sobre (player_id, date, discipline)
--    para evitar errores durante el guardado de la asistencia (UPSERT).
-- =========================================================================

-- A. Limpiamos cualquier restricción obsoleta remanente (por ejemplo, la que incluía category_id)
ALTER TABLE public.attendance 
  DROP CONSTRAINT IF EXISTS attendance_player_date_discipline_category_key;

ALTER TABLE public.attendance 
  DROP CONSTRAINT IF EXISTS attendance_player_id_date_discipline_key;

-- B. Agregamos de nuevo la restricción UNIQUE necesaria para el correcto funcionamiento de 'upsert' en la app
ALTER TABLE public.attendance 
  ADD CONSTRAINT attendance_player_id_date_discipline_key UNIQUE (player_id, date, discipline);

-- =========================================================================
-- REGISTRO DE MODIFICACIONES FUTURAS (Añada nuevos scripts a partir de aquí)
-- =========================================================================
