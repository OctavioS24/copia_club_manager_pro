-- =========================================================================
-- MIGRACIÓN V8: ALINEACIÓN Y LIMPIEZA PARA CUENTA B
-- =========================================================================
-- Este archivo contiene las instrucciones SQL necesarias para migrar, limpiar y
-- optimizar la base de datos de tu Cuenta B, alineándola al 100% con la estructura
-- actual y optimizada de tu aplicación React.
-- =========================================================================

-- 1. ELIMINAR TABLAS OBSOLETAS QUE NO UTILIZA LA APLICACIÓN
-- Estas tablas quedaron de ejecuciones previas y no son consultadas por el código.
DROP TABLE IF EXISTS public.fee_config CASCADE;
DROP TABLE IF EXISTS public.fee_generation_log CASCADE;
DROP TABLE IF EXISTS public.member_fee_overrides CASCADE;

-- 2. LIMPIAR COLUMNAS OBSOLETAS E INNECESARIAS
-- A. Tabla 'attendance': 'present' y 'notes' ya no se utilizan en la lógica de asistencia.
ALTER TABLE public.attendance DROP COLUMN IF EXISTS present;
ALTER TABLE public.attendance DROP COLUMN IF EXISTS notes;

-- B. Tabla 'tournaments': 'discipline', 'category_id', 'start_date' y 'end_date'
-- son columnas obsoletas redundantes (el sistema utiliza 'discipline_id', 'categoryid', 'assigned_categories', etc.).
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS discipline;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS category_id;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS start_date;
ALTER TABLE public.tournaments DROP COLUMN IF EXISTS end_date;

-- 3. CREAR TABLAS REQUERIDAS FALTANTES EN CUENTA B
-- Tabla para el seguimiento médico - fisiatría y kinesiología de jugadores (Kinesiología / Fisioterapia)
CREATE TABLE IF NOT EXISTS public.player_physiotherapy (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL,
  in_physiotherapy boolean NOT NULL DEFAULT false,
  sessions_requested integer NOT NULL DEFAULT 0,
  sessions_completed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'no cumplidas'::text,
  medical_order_url text,
  discharge_url text,
  treatment_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT player_physiotherapy_pkey PRIMARY KEY (id),
  CONSTRAINT player_physiotherapy_member_id_fkey FOREIGN KEY (member_id) REFERENCES public.members(id) ON DELETE CASCADE
);

-- Asegurar políticas de acceso público o RLS correspondiente para fisioterapia si está habilitado RLS
ALTER TABLE public.player_physiotherapy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all public access for player_physiotherapy" ON public.player_physiotherapy;
CREATE POLICY "Allow all public access for player_physiotherapy" 
  ON public.player_physiotherapy FOR ALL USING (true) WITH CHECK (true);

-- 4. ESTABLECER RESTRICCIÓN DE UNICIDAD CLAVE PARA LA ASISTENCIA (UPSERT)
-- Elimina restricciones de unicidad obsoletas en la tabla 'attendance' que bloqueaban o causaban conflictos.
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_player_date_discipline_category_key;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_player_id_date_discipline_category_key;
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS attendance_player_id_date_discipline_key;

-- Agrega la clave única para asegurar que el UPSERT de asistencia por (player_id, date, discipline) funcione correctamente en Cuenta B
ALTER TABLE public.attendance 
  ADD CONSTRAINT attendance_player_id_date_discipline_key UNIQUE (player_id, date, discipline);
