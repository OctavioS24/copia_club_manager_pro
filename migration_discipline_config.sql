-- Migration to create discipline_config table
CREATE TABLE IF NOT EXISTS public.discipline_config (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "discipline" TEXT NOT NULL UNIQUE,
    "scoring_rules" JSONB NOT NULL,  -- { win, draw, loss }
    "event_types" JSONB NOT NULL,     -- [{ name, icon, color, statsKey, affects_score, score_value, scope }]
    "dashboard_stats" JSONB NOT NULL, -- ["PUNTOS_ACUMULADOS", "GOLES_TOTALES", etc]
    "additional_fields" JSONB DEFAULT '[]'::jsonb, -- ["minuto", "cuarto", etc]
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE public.discipline_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.discipline_config
    FOR SELECT USING (true);

CREATE POLICY "Allow all access for authenticated users" ON public.discipline_config
    FOR ALL USING (auth.role() = 'authenticated');
