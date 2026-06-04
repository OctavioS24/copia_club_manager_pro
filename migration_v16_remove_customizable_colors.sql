-- ==========================================
-- MIGRACIÓN DE BD V16: ELIMINACIÓN DE CONFIGURACIÓN DE COLORES PERSONALIZADOS
-- ==========================================

-- 1. ELIMINACIÓN DE CAMPOS DE COLOR EN LA TABLA CLUB_CONFIG
-- Dado que el sistema ahora tiene una identidad de marca unificada con colores corporativos únicos,
-- se eliminan las columnas relacionadas con la paleta personalizable.

ALTER TABLE public.club_config 
DROP COLUMN IF EXISTS primary_color,
DROP COLUMN IF EXISTS secondary_color;

RAISE NOTICE 'Columnas primary_color y secondary_color eliminadas de club_config con éxito.';
