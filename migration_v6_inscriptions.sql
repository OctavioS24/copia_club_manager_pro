-- =========================================================================
-- MIGRACIÓN DE BD V6: ARQUITECTURA DE INSCRIPCIONES MÚLTIPLES POR JUGADOR
-- =========================================================================
-- Esta migración de base de datos rediseña la unidad operativa del club, 
-- permitiendo que un jugador pertenezca a múltiples categorías teniendo 
-- asistencias, convocatorias, estadísticas y dorsales independientes por cada una,
-- y unificando sus datos personales, médicos y de facturación base.
-- =========================================================================

BEGIN;

-- =========================================================================
-- 1. CREACIÓN DE LA TABLA DE INSCRIPCIONES (MEMBER_INSCRIPTIONS)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.member_inscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    discipline_id TEXT NOT NULL,       -- ID o nombre de la disciplina
    category_id TEXT NOT NULL,         -- ID o nombre de la categoría
    role TEXT DEFAULT 'PLAYER',        -- 'PLAYER', 'COACH', 'STAFF', etc.
    
    -- Datos deportivos independientes por categoría
    dorsal TEXT,
    frequent_position TEXT,
    skilled_leg TEXT,
    training_days_per_week TEXT,
    gym_attendance BOOLEAN DEFAULT FALSE,
    gym_frequency TEXT,
    injury_history TEXT,               -- Observaciones o historial deportivo en esta categoría
    
    -- Facturación de Cuotas: Determina cuál categoría se usará como base para el cobro
    is_main_category BOOLEAN DEFAULT FALSE,
    
    -- Auditoría
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =========================================================================
-- 2. REGLAS DE NEGOCIO E ÍNDICES ÚNICOS (MEMBER_INSCRIPTIONS)
-- =========================================================================

-- Regla 1: Un miembro no puede tener más de una inscripción activa para una misma disciplina y categoría.
CREATE UNIQUE INDEX IF NOT EXISTS u_member_discipline_category 
ON public.member_inscriptions (member_id, discipline_id, category_id);

-- Regla 2: Un miembro solo puede tener UNA categoría principal (is_main_category = TRUE) para pagos base.
CREATE UNIQUE INDEX IF NOT EXISTS u_member_main_category 
ON public.member_inscriptions (member_id) 
WHERE (is_main_category = TRUE);

-- Habilitar RLS (Seguridad a Nivel de Fila)
ALTER TABLE public.member_inscriptions ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso público/lectura-escritura general
DROP POLICY IF EXISTS "Allow all public access for member_inscriptions" ON public.member_inscriptions;
CREATE POLICY "Allow all public access for member_inscriptions" 
ON public.member_inscriptions 
FOR ALL 
USING (true);

-- Insertar un trigger para actualizar automáticamente updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_inscriptions_updated_at ON public.member_inscriptions;
CREATE TRIGGER trigger_update_inscriptions_updated_at
BEFORE UPDATE ON public.member_inscriptions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- =========================================================================
-- 3. MIGRACIÓN AUTOMÁTICA DE DATOS HISTÓRICOS (JSONB -> RELACIONAL)
-- =========================================================================
-- Este bloque analiza los registros históricos en la columna formativa `assignments` (JSONB)
-- de la tabla `members` e inserta de forma segura cada asignación como una nueva fila en 
-- `member_inscriptions`, marcando de forma automática la primera inscripción encontrada como principal.

DO $$
DECLARE
    m RECORD;
    assign JSONB;
    disc_id TEXT;
    cat_id TEXT;
    is_main BOOLEAN;
    idx INTEGER;
BEGIN
    -- Verificar si existen miembros con asignaciones en formato JSONB antiguas
    FOR m IN SELECT id, assignments FROM public.members WHERE assignments IS NOT NULL AND jsonb_array_length(assignments) > 0 LOOP
        idx := 0;
        FOR assign IN SELECT * FROM jsonb_array_elements(m.assignments) LOOP
            -- Tratar de recuperar el identificador o nombre de la disciplina
            disc_id := COALESCE(assign->>'discipline_id', assign->>'disciplineId', assign->>'discipline');
            -- Tratar de recuperar el identificador o nombre de la categoría
            cat_id := COALESCE(assign->>'category_id', assign->>'categoryId', assign->>'category');
            
            -- Si dispone de ambos datos esenciales, se procede a su traducción relacional
            IF disc_id IS NOT NULL AND cat_id IS NOT NULL THEN
                -- La primera categoría asignada se conserva por defecto como principal (is_main_category = true)
                is_main := (idx = 0);
                
                -- Insertar previniendo duplicados de ejecución previa
                IF NOT EXISTS (
                    SELECT 1 FROM public.member_inscriptions 
                    WHERE member_id = m.id AND discipline_id = disc_id AND category_id = cat_id
                ) THEN
                    INSERT INTO public.member_inscriptions (
                        member_id,
                        discipline_id,
                        category_id,
                        role,
                        dorsal,
                        frequent_position,
                        skilled_leg,
                        training_days_per_week,
                        gym_attendance,
                        gym_frequency,
                        is_main_category
                    ) VALUES (
                        m.id,
                        disc_id,
                        cat_id,
                        COALESCE(assign->>'role', 'PLAYER'),
                        assign->>'dorsal',
                        COALESCE(assign->>'position', assign->>'frequent_position'),
                        assign->>'skilled_leg',
                        assign->>'training_days_per_week',
                        COALESCE((assign->>'gym_attendance')::BOOLEAN, FALSE),
                        assign->>'gym_frequency',
                        is_main
                    );
                END IF;
                idx := idx + 1;
            END IF;
        END LOOP;
    END LOOP;
END $$;


-- =========================================================================
-- 4. ADAPTACIÓN DE LA TABLA DE ASISTENCIA (ATTENDANCE)
-- =========================================================================

-- A. Añadir la clave de inscripción (FOREIGN KEY) para vincular con la nueva tabla
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS inscription_id UUID REFERENCES public.member_inscriptions(id) ON DELETE SET NULL;

-- B. Asegurar que exista la columna category_id (para consultas rápidas e históricos sin join)
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS category_id TEXT DEFAULT '';

-- C. Limpiar registros de asistencia que contengan category_id NULL para evitar fallos de índice único o nulidad
UPDATE public.attendance SET category_id = '' WHERE category_id IS NULL;
ALTER TABLE public.attendance ALTER COLUMN category_id SET NOT NULL;
ALTER TABLE public.attendance ALTER COLUMN category_id SET DEFAULT '';

-- D. Vincular de forma retrospectiva las asistencias históricas cargadas con las nuevas filas de inscripción creadas
UPDATE public.attendance a
SET inscription_id = i.id
FROM public.member_inscriptions i
WHERE a.player_id = i.member_id 
  AND (
    (a.category_id = i.category_id)
    OR 
    (a.category_id = '' AND i.is_main_category = TRUE)
  );

-- E. Reestructuración de restricciones de unicidad sobre la asistencia
-- Eliminación de las restricciones antiguas de 3 columnas del jugador solitario
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_player_id_date_discipline_key;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_player_date_discipline_key;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_player_date_discipline_category_key;

-- Eliminación de índices redundantes
DROP INDEX IF EXISTS public.attendance_player_id_date_discipline_idx;
DROP INDEX IF EXISTS public.u_attendance_player_date_disc_cat;

-- Crear una nueva restricción de unicidad robusta que soporte asistencias separadas por día, disciplina y categoría
ALTER TABLE public.attendance 
ADD CONSTRAINT attendance_player_date_discipline_category_key 
UNIQUE (player_id, date, discipline, category_id);

COMMENT ON COLUMN public.attendance.inscription_id IS 'Referencia opcional a la inscripción relacional específica del miembro';
COMMENT ON COLUMN public.attendance.category_id IS 'ID de la categoría a la que corresponde esta planilla de asistencia';


-- =========================================================================
-- 5. ADAPTACIÓN DE CONVOCATORIAS (SQUAD_PLAYERS / CONVOCATORIAS)
-- =========================================================================

-- Añadir el campo de referencia de inscripción relacional a la tabla de convocatorias del plantel del partido.
ALTER TABLE public.match_squad_players 
ADD COLUMN IF NOT EXISTS inscription_id UUID REFERENCES public.member_inscriptions(id) ON DELETE SET NULL;

-- Vincular convocatorias pasadas en las categorías correspondientes
UPDATE public.match_squad_players msp
SET inscription_id = i.id
FROM public.match_squads ms, public.member_inscriptions i
WHERE msp.squad_id = ms.id
  AND msp.player_id = i.member_id 
  AND ms.category_id = i.category_id;

COMMENT ON COLUMN public.match_squad_players.inscription_id IS 'Enlace de la convocatoria del partido con la inscripción específica de categoría';


-- =========================================================================
-- 6. ADAPTACIÓN DE ESTADÍSTICAS Y EVENTOS DE PARTIDOS (MATCH_EVENTS)
-- =========================================================================

-- Añadir la columna de vinculación directa para guardar los eventos (goles, tarjetas, asistencias) por cada inscripción
ALTER TABLE public.match_events 
ADD COLUMN IF NOT EXISTS inscription_id UUID REFERENCES public.member_inscriptions(id) ON DELETE SET NULL;

-- Relacionar eventos del pasado mediante la planilla/convocatoria asignada
UPDATE public.match_events me
SET inscription_id = msp.inscription_id
FROM public.match_squad_players msp
WHERE me.squad_player_id = msp.id
  AND me.inscription_id IS NULL;

COMMENT ON COLUMN public.match_events.inscription_id IS 'Vínculo del evento deportivo (goles, tarjetas) con la inscripción específica para obtener estadísticas aisladas por categoría';

COMMIT;
