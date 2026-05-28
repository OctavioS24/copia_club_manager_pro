-- Ejecutar este comando en la consola de Supabase (SQL Editor)
-- para habilitar la justificación de faltas y tardanzas en la tabla de asistencia (attendance).

ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS excuse_type VARCHAR(255),
ADD COLUMN IF NOT EXISTS excuse_detail TEXT;

-- Comentarios explicativos opcionales sobre las nuevas columnas
COMMENT ON COLUMN public.attendance.excuse_type IS 'Tipo de justificación para la inasistencia o tardanza (Justificado / No justificado)';
COMMENT ON COLUMN public.attendance.excuse_detail IS 'Detalle o descripción libre del motivo de la inasistencia o tardanza';
