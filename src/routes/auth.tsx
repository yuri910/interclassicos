import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acesso do mesário — Interclássicos" },
      {
        name: "description",
        content: "Entre para lançar gols, cartões e resultados das partidas do campeonato.",
      },
      { property: "og:title", content: "Acesso do mesário — Interclássicos" },
      { property: "og:description", content: "Área restrita para mesários e organização." },
    ],
  }),
  component: AuthPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(6, { message: "A senha precisa ter ao menos 6 caracteres" }).max(72),
  name: z.string().trim().max(80).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/mesario", replace: true });
    });
  }, [navigate]);

  const validate = () => {
    const parsed = schema.safeParse({ email, password, name });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos");
      return null;
    }
    return parsed.data;
  };

  const signIn = async () => {
    const values = validate();
    if (!values) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    navigate({ to: "/mesario", replace: true });
  };

  const signUp = async () => {
    const values = validate();
    if (!values) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: values.name || values.email },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/mesario", replace: true });
      return;
    }
    toast.success("Confira seu e-mail para confirmar o cadastro.");
  };

  const signInGoogle = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Não foi possível entrar com o Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/mesario", replace: true });
  };

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14">
      <h1 className="text-stencil text-4xl font-bold">Área do mesário</h1>
      <p className="mt-1 text-muted-foreground">
        Entre para registrar gols, cartões e resultados das partidas.
      </p>

      <div className="surface-card mt-8 p-5">
        <Tabs defaultValue="login">
          <TabsList className="w-full">
            <TabsTrigger value="login" className="flex-1">
              Entrar
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              Criar conta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={loading} onClick={signIn}>
              Entrar
            </Button>
          </TabsContent>

          <TabsContent value="signup" className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email2">E-mail</Label>
              <Input
                id="email2"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password2">Senha</Label>
              <Input
                id="password2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button className="w-full" disabled={loading} onClick={signUp}>
              Criar conta de mesário
            </Button>
          </TabsContent>
        </Tabs>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>
        <Button variant="secondary" className="w-full" onClick={signInGoogle}>
          Continuar com Google
        </Button>
      </div>
    </main>
  );
}
