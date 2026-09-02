// Gerencia contas de usuário (listar/excluir) para o admin. Roda com a service role key
// (só disponível no servidor) porque a API de administração do Supabase Auth — listar todo
// mundo, apagar uma conta — não pode ser chamada com a chave anônima do cliente.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";

  // Cliente com o JWT de quem chamou — só pra confirmar (via RLS) que é admin mesmo.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData.user) return json({ error: "Não autenticado." }, 401);

  const { data: roleRows, error: roleError } = await callerClient
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin");
  if (roleError) return json({ error: roleError.message }, 500);
  if (!roleRows || roleRows.length === 0) {
    return json({ error: "Apenas administradores podem gerenciar contas." }, 403);
  }

  // Cliente com a service role — bypassa RLS e acessa a API de admin do Auth.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === "GET") {
    const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({
      perPage: 1000,
    });
    if (listError) return json({ error: listError.message }, 500);

    const { data: rolesData } = await adminClient.from("user_roles").select("user_id, role");
    const { data: profilesData } = await adminClient.from("profiles").select("id, full_name");

    const users = usersData.users.map((u) => ({
      id: u.id,
      email: u.email,
      full_name: profilesData?.find((p) => p.id === u.id)?.full_name ?? null,
      roles: (rolesData ?? []).filter((r) => r.user_id === u.id).map((r) => r.role),
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }));

    return json({ users });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    const targetId = body?.userId;
    if (!targetId || typeof targetId !== "string") {
      return json({ error: "Informe o id da conta a excluir." }, 400);
    }
    if (targetId === userData.user.id) {
      return json({ error: "Você não pode excluir a própria conta por aqui." }, 400);
    }
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(targetId);
    if (deleteError) return json({ error: deleteError.message }, 500);
    return json({ ok: true });
  }

  return json({ error: "Método não suportado." }, 405);
});
