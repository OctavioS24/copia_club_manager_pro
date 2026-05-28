-- Ejecutar estos comandos en el SQL Editor de Supabase para agregar la tabla de permisos de entrenamiento/partidos de jugadores.

CREATE TABLE IF NOT EXISTS public.player_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    permit_date DATE NOT NULL,
    club_area TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE public.player_permits ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso público (Para que entrenadores y coordinadores puedan leer, crear y modificar)
DROP POLICY IF EXISTS "Allow all public access for player_permits" ON public.player_permits;
CREATE POLICY "Allow all public access for player_permits" 
ON public.player_permits FOR ALL USING (true);
