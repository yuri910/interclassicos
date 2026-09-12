-- Instagram do time e dos jogadores.
--
-- Qualquer visitante pode preencher o @ dele na página do time, sem login. Por isso a
-- escrita NÃO vai por GRANT UPDATE direto: com o grant de tabela que o `authenticated`
-- já tem, uma policy permissiva de UPDATE abriria as outras colunas (nome, número,
-- grupo) pra qualquer pessoa logada. As duas funções abaixo são o único caminho de
-- escrita pública e tocam só a coluna `instagram`.

ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS instagram text;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS instagram text;

-- Normaliza o que a pessoa digitar: aceita "@fulano", "fulano" ou a URL do perfil,
-- e devolve só o usuário. Vazio vira NULL (limpar o campo é uma ação válida).
CREATE OR REPLACE FUNCTION public.normalize_instagram(p_handle text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := btrim(coalesce(p_handle, ''));
  v := regexp_replace(v, '^https?://(www\.)?instagram\.com/', '', 'i');
  v := regexp_replace(v, '[/?].*$', '');
  v := btrim(regexp_replace(v, '^@+', ''));
  IF v = '' THEN
    RETURN NULL;
  END IF;
  IF v !~ '^[A-Za-z0-9._]{1,30}$' THEN
    RAISE EXCEPTION 'Usuário do Instagram inválido: %', p_handle
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_player_instagram(p_player_id uuid, p_handle text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := public.normalize_instagram(p_handle);
  UPDATE public.players SET instagram = v WHERE id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jogador não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_team_instagram(p_team_id uuid, p_handle text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := public.normalize_instagram(p_handle);
  UPDATE public.teams SET instagram = v WHERE id = p_team_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Time não encontrado' USING ERRCODE = 'no_data_found';
  END IF;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.set_player_instagram(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_team_instagram(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.normalize_instagram(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_player_instagram(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_team_instagram(uuid, text) TO anon, authenticated;
