-- Aprovação manual de novas contas: só o primeiro usuário (bootstrap) vira admin+mesário
-- automaticamente. Todo cadastro seguinte fica sem papel algum até um admin aprovar.

CREATE POLICY "user_roles admin write" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE has_admin boolean;
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') INTO has_admin;

  -- Sem nenhum admin cadastrado ainda: esta conta é a fundadora, vira admin+mesário direto.
  -- Já existe admin: a conta fica sem papel nenhum até ser aprovada manualmente.
  IF NOT has_admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'mesario') ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;
