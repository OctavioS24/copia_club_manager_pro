-- ====================================================================
-- MIGRACIÓN BASE DE DATOS: GESTIÓN DE BECAS PARA MIEMBROS DEL CLUB
-- Ejecutar esta consulta en el editor SQL de Supabase
-- ====================================================================

-- 1. Asegurar campos en la tabla 'members' para asignación de becas
ALTER TABLE members ADD COLUMN IF NOT EXISTS has_scholarship BOOLEAN DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS scholarship_type_id UUID REFERENCES scholarship_types(id) ON DELETE SET NULL;
ALTER TABLE members ADD COLUMN IF NOT EXISTS scholarship_details TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS scholarship_attachment_url TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS scholarship_start_date DATE;
ALTER TABLE members ADD COLUMN IF NOT EXISTS scholarship_end_date DATE;

-- 2. (Opcional) Índices para optimizar la búsqueda y rendimiento de cálculos de cuotas
CREATE INDEX IF NOT EXISTS idx_members_has_scholarship ON members(has_scholarship) WHERE has_scholarship = true;
CREATE INDEX IF NOT EXISTS idx_members_scholarship_type ON members(scholarship_type_id) WHERE scholarship_type_id IS NOT NULL;
