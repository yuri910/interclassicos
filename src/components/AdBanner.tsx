import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useActiveRules } from "@/hooks/use-tournament";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const WHATSAPP_MESSAGE = "Vim pelo interclássicos e gostaria de um orçamento!";
const VISIT_COUNTER_KEY = "interclassicos-ad-visits";
const TRACKED_PATHS = ["/", "/classificacao"];

/** Anúncio em tela cheia mostrado a cada 2ª vez que um visitante que não é admin/mesário abre a
 * aba de Partidas ou Classificação (contador salvo no localStorage, compartilhado entre as
 * duas). Clicar no banner abre o WhatsApp com uma mensagem pronta. */
export function AdBanner() {
  const { isStaff, loading: authLoading } = useAuth();
  const { edition } = useActiveRules();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const countedPathRef = useRef<string | null>(null);

  const bannerUrl = edition?.ad_banner_url ?? null;
  const adEnabled = edition?.ad_enabled ?? false;

  // Conta uma abertura por navegação real pra Partidas/Classificação (não recontabiliza
  // re-renders na mesma página; contabiliza de novo se a pessoa sair e voltar).
  useEffect(() => {
    if (!TRACKED_PATHS.includes(pathname)) {
      countedPathRef.current = null;
      return;
    }
    if (authLoading || isStaff) return;
    if (countedPathRef.current === pathname) return;
    countedPathRef.current = pathname;
    try {
      const next = Number(localStorage.getItem(VISIT_COUNTER_KEY) ?? "0") + 1;
      localStorage.setItem(VISIT_COUNTER_KEY, String(next));
      if (next % 2 === 0) setShouldShow(true);
    } catch {
      // sem acesso ao localStorage (aba privada etc.) — não dá pra contar, então não mostra.
    }
  }, [pathname, authLoading, isStaff]);

  // Só abre de fato quando o banner da edição já carregou (pode chegar depois da contagem).
  useEffect(() => {
    if (shouldShow && adEnabled && bannerUrl) {
      setOpen(true);
      setShouldShow(false);
    }
  }, [shouldShow, adEnabled, bannerUrl]);

  const handleClickBanner = () => {
    setOpen(false);
    const phone = (edition?.ad_whatsapp_phone ?? "").replace(/\D/g, "");
    if (!phone) return;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!bannerUrl) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md overflow-hidden border-0 p-0 sm:rounded-xl">
        <DialogTitle className="sr-only">Anúncio</DialogTitle>
        <div className="relative">
          <div className="pointer-events-none absolute right-2 top-2 z-0 size-9 rounded-full bg-black/45" />
          <button type="button" onClick={handleClickBanner} className="block w-full cursor-pointer">
            <img src={bannerUrl} alt="Anúncio" className="w-full" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
