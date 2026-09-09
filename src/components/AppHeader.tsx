import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Trophy,
  ClipboardList,
  Settings,
  LogOut,
  LogIn,
  Megaphone,
} from "lucide-react";
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:gap-x-6 sm:py-3">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Interclássicos DuoVolts">
          <img
            src="/marca-bola.webp"
            alt=""
            aria-hidden
            className="size-9 shrink-0 object-contain sm:size-10"
          />
          <span className="flex flex-col gap-1">
            <img
              src="/marca-nome.webp"
              alt="Interclássicos"
              className="h-3 w-auto object-contain sm:h-4"
            />
            <img
              src="/marca-duovolts.webp"
              alt="DuoVolts Engenharia"
              className="h-2.5 w-auto self-start object-contain opacity-65 sm:h-3"
            />
          </span>
        </Link>

        <nav className="order-3 -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:order-2 sm:mx-0 sm:w-auto sm:flex-1 sm:px-0">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "text-stencil whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground",
                pathname === item.to && "bg-primary/20 text-primary ring-1 ring-primary/40",
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
