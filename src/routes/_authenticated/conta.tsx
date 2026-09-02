import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Check, Hourglass, KeyRound, ShieldAlert, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useAdminUsers, useDeleteAdminUser } from "@/hooks/use-admin-users";
import { formatDate } from "@/lib/tournament";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/conta")({
  head: () => ({
    meta: [
      { title: "Minha conta — Interclássicos" },
      { name: "description", content: "Altere sua senha e gerencie contas cadastradas." },
    ],
  }),
  component: ContaPage,
});

const passwordSchema = z.string().min(6, { message: "A senha precisa ter ao menos 6 caracteres" });

function ContaPage() {
  const { user, isAdmin, isStaff } = useAuth();
  const queryClient = useQueryClient();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const updatePassword = useMutation({
    mutationFn: async () => {
      const parsed = passwordSchema.safeParse(newPassword);
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Senha inválida");
      if (newPassword !== confirmPassword) throw new Error("As senhas não coincidem");
      const { error } = await supabase.auth.updateUser({ password: parsed.data });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Senha atualizada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: users, isLoading: usersLoading } = useAdminUsers(isAdmin);
  const deleteUser = useDeleteAdminUser();

  const approveUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: "mesario" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_users"] });
      toast.success("Conta aprovada — acesso de mesário liberado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleDelete = (id: string, label: string) => {
    if (!window.confirm(`Excluir a conta de ${label}? Essa ação não pode ser desfeita.`)) return;
    deleteUser.mutate(id, {
      onSuccess: () => toast.success("Conta excluída."),
      onError: (e: Error) => toast.error(e.message),
    });
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-stencil text-4xl font-bold">Minha conta</h1>
      <p className="mt-1 text-muted-foreground">{user?.email}</p>

      {!isStaff && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <Hourglass className="mt-0.5 size-5 shrink-0 text-primary" />
          <p>
            Sua conta ainda não foi aprovada por um administrador. Assim que aprovada, o acesso
            de mesário (e à aba Marketing) aparece automaticamente aqui no menu.
          </p>
        </div>
      )}

      <section className="surface-card mt-8 p-5">
        <h2 className="text-stencil flex items-center gap-2 text-lg font-bold">
          <KeyRound className="size-5 text-primary" /> Alterar senha
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">Nova senha</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirmar nova senha</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </div>
        </div>
        <Button
          className="mt-4"
          disabled={updatePassword.isPending || !newPassword}
          onClick={() => updatePassword.mutate()}
        >
          Salvar nova senha
        </Button>
      </section>

      {isAdmin && (
        <section className="surface-card mt-8 overflow-hidden">
          <h2 className="text-stencil flex items-center gap-2 border-b border-border px-5 py-3 text-lg font-bold">
            <ShieldAlert className="size-5 text-primary" /> Contas cadastradas
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{u.full_name ?? "—"}</TableCell>
                  <TableCell>
                    {u.roles.length === 0 ? (
                      <span className="text-xs text-muted-foreground">sem papel</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map((r) => (
                          <Badge key={r} variant="secondary">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(u.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {u.roles.length === 0 && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={approveUser.isPending}
                          onClick={() => approveUser.mutate(u.id)}
                        >
                          <Check className="size-4" /> Aprovar
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Excluir conta"
                        disabled={deleteUser.isPending || u.id === user?.id}
                        onClick={() => handleDelete(u.id, u.email ?? u.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!usersLoading && (users ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    Nenhuma conta encontrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>
      )}
    </main>
  );
}
