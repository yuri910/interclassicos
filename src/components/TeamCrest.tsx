import { teamCrestUrl } from "@/lib/team-logos";
import { cn } from "@/lib/utils";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-xs",
  lg: "size-14 text-sm",
  xl: "size-20 text-lg",
} as const;

/**
 * Escudo do time. Os arquivos vêm com fundo transparente e proporções
 * diferentes, então a arte é contida (nunca cortada) dentro de um disco escuro
 * que dá contraste em cima do fundo de estádio. Sem arte, mostra a inicial.
 */
export function TeamCrest({
  logoUrl,
  name,
  size = "sm",
  className,
}: {
  logoUrl?: string | null | undefined;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const src = teamCrestUrl(name, logoUrl);

  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full",
        "bg-white/8 ring-1 ring-white/15",
        SIZES[size],
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt={`Escudo do ${name}`}
          loading="lazy"
          decoding="async"
          className="size-[82%] object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]"
        />
      ) : (
        <span aria-hidden className="font-bold leading-none text-foreground/80">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
