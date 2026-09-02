import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-6 text-[10px]",
  md: "size-8 text-xs",
  lg: "size-12 text-base",
} as const;

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
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {logoUrl && <AvatarImage src={logoUrl} alt={name} className="object-cover" />}
      <AvatarFallback className="font-semibold">{name.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  );
}
