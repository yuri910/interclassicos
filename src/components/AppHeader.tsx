import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Trophy, ClipboardList, Settings, LogOut, LogIn, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Partidas", icon: CalendarDays },
  { to: "/classificacao", label: "Classificação", icon: Trophy },
  { to: "/rankings", label: "Rankings", icon: Trophy },
];

export function AppHeader() {
  const { user, isStaff, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const nav = [
    ...links,
    ...(isStaff ? [{ to: "/mesario", label: "Mesário", icon: ClipboardList }] : []),
    ...(isStaff ? [{ to: "/marketing", label: "Marketing", icon: Megaphone }] : []),
    ...(isAdmin ? [{ to: "/edicao", label: "Edição", icon: Trophy }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground text-lg">
            ⚽
          </span>
          <span className="text-stencil text-xl font-bold leading-none">Interclássicos</span>
        </Link>

        <nav className="order-3 flex w-full gap-1 overflow-x-auto sm:order-2 sm:w-auto sm:flex-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "text-stencil whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                pathname === item.to && "bg-secondary text-primary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-1 sm:order-3">
          {user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/conta">
                  <Settings className="size-4" /> Minha conta
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="size-4" /> Sair
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">
                <LogIn className="size-4" /> Entrar
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
