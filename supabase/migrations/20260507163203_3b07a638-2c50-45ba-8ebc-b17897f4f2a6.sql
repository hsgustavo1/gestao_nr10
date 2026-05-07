CREATE POLICY "violations_admin_update" ON public.padlock_violations
FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));