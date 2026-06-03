-- =========================================================================
-- MIGRACIÓN DE BD V12: INCORPORACIÓN DE CONCEPTO EN SEGREGACIÓN DE COBROS
-- =========================================================================
-- Agrega soporte para identificar de forma independiente los tipos de pago,
-- permitiendo separar conceptualmente las 'Cuotas Mensuales' de las 'Inscripciones'.

BEGIN;

-- 1. Incorporar columna `concept` a la tabla `fees` con valor por defecto 'Cuota Mensual'
ALTER TABLE public.fees 
ADD COLUMN IF NOT EXISTS concept TEXT DEFAULT 'Cuota Mensual';

-- 2. Asegurar que todos los registros históricos tengan asignado un concepto
UPDATE public.fees 
SET concept = 'Cuota Mensual' 
WHERE concept IS NULL;

-- 3. Crear un índice sobre la columna `concept` para agilizar estadísticas y desgloses
CREATE INDEX IF NOT EXISTS idx_fees_concept ON public.fees (concept);

COMMIT;
