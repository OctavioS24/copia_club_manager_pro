-- Ejecutar estos comandos en el SQL Editor de Supabase para agregar compromisos de pago
-- y desactivar temporalmente las advertencias de deuda para aquellos con promesas registradas.

CREATE TABLE IF NOT EXISTS public.payment_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
    commitment_date DATE NOT NULL,
    detail TEXT NOT NULL,
    fulfilled BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS (Seguridad a nivel de fila) si es necesario
ALTER TABLE public.payment_commitments ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso público (Para que entrenadores y coordinadores puedan leer, crear y modificar)
DROP POLICY IF EXISTS "Allow all public access for payment_commitments" ON public.payment_commitments;
CREATE POLICY "Allow all public access for payment_commitments" 
ON public.payment_commitments FOR ALL USING (true);
