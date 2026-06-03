-- =========================================================================
-- MIGRACIÓN DE BD V13: AMPLIACIÓN DE MÓDULO PAGOS CON ANULACIONES Y COMENTARIOS
-- =========================================================================
-- Agrega soporte para guardar comentarios en los cobros realizados
-- y registrar el motivo de anulación de un pago sin necesidad de eliminarlo.

BEGIN;

-- 1. Incorporar columna `comment` (comentario/observaciones) del cobro
ALTER TABLE public.fees 
ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT '';

-- 2. Incorporar columna `void_reason` (motivo de anulación)
ALTER TABLE public.fees 
ADD COLUMN IF NOT EXISTS void_reason TEXT;

-- 3. Incorporar columna `is_voided` (indicador booleano de anulación)
ALTER TABLE public.fees 
ADD COLUMN IF NOT EXISTS is_voided BOOLEAN DEFAULT FALSE;

-- 4. Crear índices para agilizar consultas sobre anulados e informes
CREATE INDEX IF NOT EXISTS idx_fees_is_voided ON public.fees (is_voided);

COMMIT;
