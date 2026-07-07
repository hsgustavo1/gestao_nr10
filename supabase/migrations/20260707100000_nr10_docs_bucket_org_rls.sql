-- Bug: upload de ART na turma NR-10 (bucket nr10-docs) falhava para
-- consultores/clientes ("Você não tem permissão para enviar este arquivo")
-- porque a policy de INSERT/UPDATE do bucket ainda usava is_staff() — checagem
-- de role global legada, nunca migrada para o modelo multi-tenant (nr10_trainings
-- em si já usa fn_employee_editable desde 20260629000000_pessoas_org_rls_created_by).
-- O bucket não guarda org_id no path, então o critério aqui é "pertence a
-- alguma organização com papel >= member" (equivalente ao piso de acesso já
-- usado em fn_employee_editable), em vez do binding por org_id específico.

DROP POLICY IF EXISTS "nr10_docs_staff_insert" ON storage.objects;
DROP POLICY IF EXISTS "nr10_docs_staff_update" ON storage.objects;

CREATE POLICY "nr10_docs_org_insert"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'nr10-docs'
  AND (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND public.org_role_rank(m.org_role) >= public.org_role_rank('member')
    )
  )
);

CREATE POLICY "nr10_docs_org_update"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'nr10-docs'
  AND (
    public.is_staff(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.org_memberships m
      WHERE m.user_id = auth.uid()
        AND public.org_role_rank(m.org_role) >= public.org_role_rank('member')
    )
  )
);
