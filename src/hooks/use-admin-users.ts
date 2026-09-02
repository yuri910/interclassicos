import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** supabase-js só expõe um erro genérico pra respostas non-2xx de Edge Function — a mensagem
 * de verdade (ex.: "Apenas administradores podem gerenciar contas.") vem no corpo JSON. */
async function functionErrorMessage(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (typeof body?.error === "string") return body.error;
    } catch {
      // corpo não era JSON — segue com a mensagem genérica abaixo.
    }
  }
  return error instanceof Error ? error.message : "Erro inesperado.";
}

export type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
};

/** Lista todas as contas cadastradas — só funciona para quem é admin (a função valida isso
 * no servidor, com a service role key, já que a API de admin do Auth não roda no cliente). */
export function useAdminUsers(enabled: boolean) {
  return useQuery({
    queryKey: ["admin_users"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<{ users: AdminUser[] }>(
        "admin-users",
        { method: "GET" },
      );
      if (error) throw new Error(await functionErrorMessage(error));
      return data?.users ?? [];
    },
  });
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke<{ error?: string }>("admin-users", {
        method: "POST",
        body: { userId },
      });
      if (error) throw new Error(await functionErrorMessage(error));
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
    },
  });
}
