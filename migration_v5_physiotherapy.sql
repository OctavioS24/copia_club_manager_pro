-- Ejecutar estos comandos en el SQL Editor de Supabase para agregar la tabla de fisioterapia paraclubes.

CREATE TABLE IF NOT EXISTS public.player_physiotherapy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    in_physiotherapy BOOLEAN DEFAULT FALSE NOT NULL,
    sessions_requested INTEGER DEFAULT 0 NOT NULL,
    sessions_completed INTEGER DEFAULT 0 NOT NULL,
    status TEXT DEFAULT 'no cumplidas' NOT NULL, -- 'cumplidas' / 'no cumplidas'
    medical_order_url TEXT,
    discharge_url TEXT,
    treatment_date DATE DEFAULT CURRENT_DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Seguridad a nivel de fila)
ALTER TABLE public.player_physiotherapy ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso público
DROP POLICY IF EXISTS "Allow all public access for player_physiotherapy" ON public.player_physiotherapy;
CREATE POLICY "Allow all public access for player_physiotherapy" 
ON public.player_physiotherapy FOR ALL USING (true);
