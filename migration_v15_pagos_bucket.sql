-- ==========================================
-- MIGRACIÓN DE BD V15: CONFIGURACIÓN DE STORAGE 'pagos', TRUNCADO DE DATOS Y CASOS DE PRUEBA
-- ==========================================

-- 1. CREACIÓN DEL BUCKET 'pagos' EN STORAGE
INSERT INTO storage.buckets (id, name, public)
VALUES ('pagos', 'pagos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. POLÍTICAS DE ACCESO PARA EL BUCKET 'pagos' HOY ORGANIZADO
DROP POLICY IF EXISTS "Public Access para lectura en pagos" ON storage.objects;
CREATE POLICY "Public Access para lectura en pagos" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'pagos');

DROP POLICY IF EXISTS "Public Access para inserción en pagos" ON storage.objects;
CREATE POLICY "Public Access para inserción en pagos" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'pagos');

DROP POLICY IF EXISTS "Public Access para eliminación en pagos" ON storage.objects;
CREATE POLICY "Public Access para eliminación en pagos" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'pagos');

-- 3. ELIMINACIÓN DE REGISTROS DE PAGOS (CUOTAS Y COMPROMISOS)
DELETE FROM public.fees;
DELETE FROM public.payment_commitments;

-- 4. INSERCIÓN DE CASOS DE PRUEBA DILIGENTES (Para el primer socio disponible)
DO $$
DECLARE
    v_member_id UUID;
BEGIN
    -- Obtener el primer miembro/socio de la tabla members
    SELECT id INTO v_member_id FROM public.members LIMIT 1;
    
    IF v_member_id IS NOT NULL THEN
        -- Caso 1: Cuota Pendiente del mes actual
        INSERT INTO public.fees (id, member_id, amount, period, status, due_date, concept, comment)
        VALUES (
            gen_random_uuid(),
            v_member_id,
            12000,
            to_char(CURRENT_DATE, 'YYYY-MM'),
            'Pending',
            (date_trunc('month', CURRENT_DATE) + interval '9 days')::date::text,
            'Cuota Mensual',
            'Cuota pendiente del mes en curso para pruebas'
        );

        -- Caso 2: Cuota Vencida del mes anterior
        INSERT INTO public.fees (id, member_id, amount, period, status, due_date, concept, comment)
        VALUES (
            gen_random_uuid(),
            v_member_id,
            12000,
            to_char(CURRENT_DATE - interval '1 month', 'YYYY-MM'),
            'Late',
            (date_trunc('month', CURRENT_DATE - interval '1 month') + interval '9 days')::date::text,
            'Cuota Mensual',
            'Causa recargo si sobrepasa la fecha de vencimiento'
        );

        -- Caso 3: Cuota Pagada de hace 2 meses (con comprobante simulado en la nueva ruta)
        INSERT INTO public.fees (id, member_id, amount, period, status, due_date, payment_date, payment_method, receipt_url, concept, comment)
        VALUES (
            gen_random_uuid(),
            v_member_id,
            12000,
            to_char(CURRENT_DATE - interval '2 month', 'YYYY-MM'),
            'Paid',
            (date_trunc('month', CURRENT_DATE - interval '2 month') + interval '9 days')::date::text,
            (date_trunc('month', CURRENT_DATE - interval '2 month') + interval '5 days')::date::text,
            'Transferencia',
            'https://itbdqcudsvjpmfzhjecb.supabase.co/storage/v1/object/public/pagos/comprobantes/test_comprobante.jpg',
            'Cuota Mensual',
            'Pago registrado con comprobante en la carpeta pagos/comprobantes/'
        );

        -- Caso 4: Cuota Anulada
        INSERT INTO public.fees (id, member_id, amount, period, status, due_date, concept, comment, void_reason)
        VALUES (
            gen_random_uuid(),
            v_member_id,
            12000,
            to_char(CURRENT_DATE - interval '3 month', 'YYYY-MM'),
            'Anulado',
            (date_trunc('month', CURRENT_DATE - interval '3 month') + interval '9 days')::date::text,
            'Cuota Mensual',
            'Cuota errónea anulada de prueba',
            'Datos de facturación incorrectos'
        );

        -- Caso 5: Compromiso de Pago activo para el socio
        INSERT INTO public.payment_commitments (id, member_id, amount, commitment_date, notes, fulfilled, created_at)
        VALUES (
            gen_random_uuid(),
            v_member_id,
            12000,
            (CURRENT_DATE + interval '5 days')::date::text,
            'Socio se compromete a pagar el saldo vencido el próximo fin de semana',
            false,
            now()
        );
        
        RAISE NOTICE 'Casos de prueba generados exitosamente para el socio con ID %', v_member_id;
    ELSE
        RAISE NOTICE 'Atención: No hay socios en la base de datos. Por favor, agregue al menos un socio antes de probar.';
    END IF;
END $$;
