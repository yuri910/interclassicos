/**
 * Escudos dos times.
 *
 * O cadastro no Supabase tem a coluna `logo_url`, mas hoje ela está vazia para
 * todos os times — as artes vieram do repo das postagens e ficam versionadas em
 * `public/times/<slug>.webp`. Então o nome do time vira slug e cai no arquivo
 * local; quando alguém subir um logo pelo painel, o `logo_url` ganha prioridade.
 */

const KNOWN_SLUGS = new Set([
  "alma-verde",
  "catados",
  "dream-team",
  "esag",
  "exaustos",
  "joga-easy",
  "maristars",
  "mg-michel",
  "michel-old-boys",
  "ohsht",
  "orion-fc",
  "revelacao",
  "satc-2024",
  "tropa-do-sazon",
]);

/** Nome cadastrado que não bate com o arquivo entregue pelo time. */
const ALIASES: Record<string, string> = {
  "exaustos-fc": "exaustos",
};

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Escudo local do time, ou `null` se não houver arte para esse nome. */
export function localCrestUrl(name: string | null | undefined) {
  if (!name) return null;
  const slug = slugify(name);
  const resolved = ALIASES[slug] ?? slug;
  return KNOWN_SLUGS.has(resolved) ? `/times/${resolved}.webp` : null;
}

/** Logo a usar no time: o cadastrado no painel vence, senão o arquivo local. */
export function teamCrestUrl(name: string | null | undefined, logoUrl?: string | null) {
  return logoUrl || localCrestUrl(name);
}
