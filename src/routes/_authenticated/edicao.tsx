import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  useEditions,
  useEvents,
  useMatches,
  usePlayers,
  useTeams,
  type Edition,
} from "@/hooks/use-tournament";
import { formatDate } from "@/lib/tournament";
import { computeGroupStandings } from "@/lib/standings";
import { TeamCrest } from "@/components/TeamCrest";
import { useSponsors } from "@/hooks/use-marketing";
import { bracketMatchPlan } from "@/lib/bracket";
import { createScheduler, parseClock, roundRobinRounds } from "@/lib/scheduling";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/edicao")({
  head: () => ({
    meta: [
      { title: "Edições e sorteio — Interclássicos" },
      {
        name: "description",
        content: "Crie a edição do campeonato e realize o sorteio oficial dos grupos e jogos.",
      },
      { property: "og:title", content: "Edições e sorteio — Interclássicos" },
      {
        property: "og:description",
        content: "Criação da edição do campeonato e sorteio oficial dos grupos.",
      },
    ],
  }),
  component: EdicaoPage,
});

const GROUP_LETTERS = "ABCDEFGH".split("");

const RULE_FIELDS = [
  {
    key: "foul_shootout_limit",
    label: "Faltas para shoot out (por tempo)",
    hint: "A partir desta quantidade, as faltas seguintes do time no tempo são shoot out.",
  },
  {
    key: "yellows_for_suspension",
    label: "Amarelos para suspensão",
    hint: "Quantos cartões amarelos acumulados suspendem o atleta.",
  },
  {
    key: "games_to_reset_yellows",
    label: "Jogos para zerar amarelos",
    hint: "0 = a contagem nunca reinicia durante a edição.",
  },
  {
    key: "suspension_games_yellow",
    label: "Jogos de suspensão por amarelos",
    hint: "Quantas partidas o atleta fica fora ao atingir o limite de amarelos.",
  },
  {
    key: "suspension_games_red",
    label: "Jogos de suspensão por vermelho",
    hint: "Quantas partidas o atleta fica fora após ser expulso.",
  },
] as const;

type RuleKey = (typeof RULE_FIELDS)[number]["key"];

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

function parseBulkTeamNames(raw: string): string[] {
  const normalized = raw.replace(/\r/g, "\n");
  const names = normalized
    .split(/\n|;|,|\t|\|/)
    .map((value) => value.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  return names.filter((name) => {
    const normalizedName = name.toLowerCase();
    if (seen.has(normalizedName)) return false;
    seen.add(normalizedName);
    return true;
  });
}

function parseBulkPlayers(raw: string): Array<{ name: string; shirtNumber: number | null }> {
  const normalized = raw.replace(/\r/g, "\n");
  const lines = normalized
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: Array<{ name: string; shirtNumber: number | null }> = [];

  for (const line of lines) {
    const cleaned = line.replace(/\s+/g, " ");
    const parts = cleaned
      .split(/[;,\t|]/)
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) continue;

    const last = parts[parts.length - 1];
    const shirtNumber = Number(last);
    const hasValidShirt = Number.isInteger(shirtNumber) && shirtNumber >= 1 && shirtNumber <= 99;

    if (parts.length >= 2 && hasValidShirt) {
      const name = parts.slice(0, -1).join(" ").trim();
      if (name) {
        parsed.push({ name, shirtNumber });
        continue;
      }
    }

    const fallbackName = parts[0] ?? "";
    const fallbackShirt = parts[1] ? Number(parts[1]) : null;
    const maybeValidFallback =
      fallbackShirt !== null &&
      Number.isInteger(fallbackShirt) &&
      fallbackShirt >= 1 &&
      fallbackShirt <= 99;

    if (fallbackName && maybeValidFallback) {
      parsed.push({ name: fallbackName, shirtNumber: fallbackShirt });
      continue;
    }

    if (fallbackName) {
      parsed.push({ name: fallbackName, shirtNumber: null });
    }
  }

  return parsed;
}

function getFormatStorageKey(editionId: string) {
  return `edition-format:${editionId}`;
}

function readStoredFormat(editionId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getFormatStorageKey(editionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ouroSpots?: string; prataSpots?: string };
    return {
      ouroSpots: parsed.ouroSpots ?? "4",
      prataSpots: parsed.prataSpots ?? "3",
    };
  } catch {
    return null;
  }
}

function saveStoredFormat(editionId: string, values: { ouroSpots: string; prataSpots: string }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getFormatStorageKey(editionId), JSON.stringify(values));
}

type BlockedRange = { start: string; end: string };

const DEFAULT_BLOCKED_RANGES: BlockedRange[] = [{ start: "12:00", end: "13:00" }];

function getScheduleStorageKey(editionId: string) {
  return `edition-schedule:${editionId}`;
}

function readStoredSchedule(editionId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getScheduleStorageKey(editionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      eventDates?: string[];
      dayStartTime?: string;
      dayEndTime?: string;
      blockedRanges?: BlockedRange[];
    };
    return {
      eventDates: Array.isArray(parsed.eventDates) ? parsed.eventDates : [],
      dayStartTime: parsed.dayStartTime ?? "08:00",
      dayEndTime: parsed.dayEndTime ?? "22:00",
      blockedRanges: Array.isArray(parsed.blockedRanges)
        ? parsed.blockedRanges
        : DEFAULT_BLOCKED_RANGES,
    };
  } catch {
    return null;
  }
}

function saveStoredSchedule(
  editionId: string,
  values: {
    eventDates: string[];
    dayStartTime: string;
    dayEndTime: string;
    blockedRanges: BlockedRange[];
  },
) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getScheduleStorageKey(editionId), JSON.stringify(values));
}

function getPageStateStorageKey() {
  return "edicao-page-state";
}

type PersistedPageState = {
  selectedEditionId: string;
};

function readStoredPageState() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getPageStateStorageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedPageState>;
    return {
      selectedEditionId: parsed.selectedEditionId ?? "",
    } satisfies PersistedPageState;
  } catch {
    return null;
  }
}

function saveStoredPageState(state: PersistedPageState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getPageStateStorageKey(), JSON.stringify(state));
}

// Inputs nativos type="date"/type="time" exibem o formato do idioma do
// sistema operacional (ignoram o lang="pt-BR" da página), então em
// máquinas com locale en-US o usuário via mm/dd/yyyy e relógio 12h. Estes
// campos de texto mascarados forçam dd/mm/yyyy e HH:mm sempre, para
// qualquer usuário, mantendo o valor interno em ISO (yyyy-mm-dd / HH:mm).
function isoDateToBr(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

function maskBrDate(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  return [d, m, y].filter(Boolean).join("/");
}

function brDateToIso(br: string): string {
  const digits = br.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const d = digits.slice(0, 2);
  const m = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  const date = new Date(`${y}-${m}-${d}T00:00:00`);
  if (
    Number.isNaN(date.getTime()) ||
    date.getDate() !== Number(d) ||
    date.getMonth() + 1 !== Number(m)
  )
    return "";
  return `${y}-${m}-${d}`;
}

function DateFieldBR({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const [text, setText] = useState(() => isoDateToBr(value));

  useEffect(() => {
    setText(isoDateToBr(value));
  }, [value]);

  return (
    <Input
      id={id}
      inputMode="numeric"
      placeholder="dd/mm/aaaa"
      value={text}
      onChange={(e) => {
        const masked = maskBrDate(e.target.value);
        setText(masked);
        const iso = brDateToIso(masked);
        if (iso) onChange(iso);
      }}
    />
  );
}

function maskTime24(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  const h = digits.slice(0, 2);
  const min = digits.slice(2, 4);
  return min ? `${h}:${min}` : h;
}

function TimeField24({
  id,
  ariaLabel,
  value,
  onChange,
}: {
  id?: string;
  ariaLabel?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [text, setText] = useState(value);

  useEffect(() => {
    setText(value);
  }, [value]);

  return (
    <Input
      id={id}
      aria-label={ariaLabel}
      inputMode="numeric"
      placeholder="HH:mm"
      value={text}
      onChange={(e) => {
        const masked = maskTime24(e.target.value);
        setText(masked);
        if (/^([01]\d|2[0-3]):[0-5]\d$/.test(masked)) onChange(masked);
      }}
    />
  );
}

function EdicaoPage() {
  const qc = useQueryClient();
  const { data: editions } = useEditions();
  const { data: teams } = useTeams();
  const { data: players } = usePlayers();
  const { data: matches } = useMatches();
  const { data: events } = useEvents();
  const { data: sponsors } = useSponsors();

  const [name, setName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));

  const [selectedEditionId, setSelectedEditionId] = useState("");
  const [manageTab, setManageTab] = useState<"teams" | "setup">("teams");
  const [teamName, setTeamName] = useState("");
  const [bulkTeamNames, setBulkTeamNames] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [playerTeam, setPlayerTeam] = useState("");
  const [shirt, setShirt] = useState("");
  const [bulkPlayers, setBulkPlayers] = useState("");
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [teamEditorPlayerName, setTeamEditorPlayerName] = useState("");
  const [teamEditorShirt, setTeamEditorShirt] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState("");
  const [editingPlayerShirt, setEditingPlayerShirt] = useState("");

  const [adPhone, setAdPhone] = useState("");

  const [ruleValues, setRuleValues] = useState<Record<RuleKey, string>>({
    foul_shootout_limit: "6",
    yellows_for_suspension: "3",
    games_to_reset_yellows: "0",
    suspension_games_yellow: "1",
    suspension_games_red: "1",
  });
  const [groupCount, setGroupCount] = useState("2");
  const [ouroSpots, setOuroSpots] = useState("4");
  const [prataSpots, setPrataSpots] = useState("3");
  const [eventDates, setEventDates] = useState<string[]>([]);
  const [newEventDate, setNewEventDate] = useState("");
  const [dayStartTime, setDayStartTime] = useState("08:00");
  const [dayEndTime, setDayEndTime] = useState("22:00");
  const [blockedRanges, setBlockedRanges] = useState<BlockedRange[]>(DEFAULT_BLOCKED_RANGES);
  const [intervalMin, setIntervalMin] = useState("60");
  const [fields, setFields] = useState("Campo 1");
  const [preview, setPreview] = useState<{ group: string; names: string[] }[]>([]);
  const [playoffDialogOpen, setPlayoffDialogOpen] = useState(false);
  const [playoffDate, setPlayoffDate] = useState("");
  const [playoffStartTime, setPlayoffStartTime] = useState("08:00");
  const [playoffIntervalMin, setPlayoffIntervalMin] = useState("60");

  const selectedEdition = (editions ?? []).find((e) => e.id === selectedEditionId);
  const editionTeams = (teams ?? []).filter((t) => t.edition_id === selectedEditionId);
  const editionTeamCount = editionTeams.length;
  const editionPlayers = (players ?? []).filter((player) =>
    editionTeams.some((team) => team.id === player.team_id),
  );
  const editionMatches = (matches ?? []).filter((match) => match.edition_id === selectedEditionId);

  const activeEdition = (editions ?? []).find((e) => e.is_active);

  const groupStandings = computeGroupStandings({
    teams: editionTeams,
    matches: editionMatches,
    events: events ?? [],
  });
  const groupsReadyForPlayoffs =
    groupStandings.length >= 2 && groupStandings.every((g) => g.complete);

  // Aplica ao formulário as regras/formato/agenda salvos da edição aberta.
  // Roda uma única vez por edição (guardado pelo ref), não a cada refetch.
  const appliedEditionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedEditionId || !editions) return;
    if (appliedEditionRef.current === selectedEditionId) return;
    const edition = editions.find((e) => e.id === selectedEditionId);
    if (!edition) return;
    appliedEditionRef.current = selectedEditionId;
    setRuleValues({
      foul_shootout_limit: String(edition.foul_shootout_limit),
      yellows_for_suspension: String(edition.yellows_for_suspension),
      games_to_reset_yellows: String(edition.games_to_reset_yellows),
      suspension_games_yellow: String(edition.suspension_games_yellow),
      suspension_games_red: String(edition.suspension_games_red),
    });
    setAdPhone(edition.ad_whatsapp_phone ?? "");
    const storedFormat = readStoredFormat(edition.id);
    if (storedFormat) {
      setOuroSpots(storedFormat.ouroSpots);
      setPrataSpots(storedFormat.prataSpots);
    } else {
      setOuroSpots(String(edition.ouro_qualifiers ?? 4));
      setPrataSpots(String(edition.prata_qualifiers ?? 3));
    }
    const storedSchedule = readStoredSchedule(edition.id);
    if (storedSchedule) {
      setEventDates(storedSchedule.eventDates);
      setDayStartTime(storedSchedule.dayStartTime);
      setDayEndTime(storedSchedule.dayEndTime);
      setBlockedRanges(storedSchedule.blockedRanges);
    } else {
      setEventDates([]);
      setDayStartTime("08:00");
      setDayEndTime("22:00");
      setBlockedRanges(DEFAULT_BLOCKED_RANGES);
    }
  }, [selectedEditionId, editions]);

  const openEdition = (id: string) => {
    setManageTab("teams");
    setSelectedEditionId(id);
  };

  const closeEdition = () => {
    appliedEditionRef.current = null;
    setSelectedEditionId("");
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredPageState();
    if (stored?.selectedEditionId) {
      setSelectedEditionId(stored.selectedEditionId);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    saveStoredPageState({ selectedEditionId });
  }, [selectedEditionId]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["editions"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["players"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["sponsors"] });
  };

  const saveFormatConfig = useMutation({
    mutationFn: async () => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const total = editionTeamCount;
      const gold = Number(ouroSpots);
      const silver = Number(prataSpots);
      if (total < 4) throw new Error("Cadastre ao menos 4 times antes de salvar o formato");
      if (!Number.isInteger(gold) || gold < 1 || gold > total)
        throw new Error("Quantidade para Série Ouro inválida");
      if (!Number.isInteger(silver) || silver < 1 || silver > total)
        throw new Error("Quantidade para Série Prata inválida");
      const payload = {
        team_count: total,
        ouro_qualifiers: gold,
        prata_qualifiers: silver,
      };
      const { error } = await supabase.from("editions").update(payload).eq("id", selectedEditionId);
      if (error) throw error;
      saveStoredFormat(selectedEditionId, {
        ouroSpots: String(gold),
        prataSpots: String(silver),
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(
        "Configuração do formato atualizada. Gere/atualize os playoffs para refletir nos jogos.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEdition = useMutation({
    mutationFn: async (id: string) => {
      const teamsForEdition = (teams ?? [])
        .filter((team) => team.edition_id === id)
        .map((team) => team.id);

      if (teamsForEdition.length > 0) {
        const { error: playersError } = await supabase
          .from("players")
          .delete()
          .in("team_id", teamsForEdition);
        if (playersError) throw playersError;
      }

      const matchesForEdition = (matches ?? [])
        .filter((match) => match.edition_id === id)
        .map((match) => match.id);
      if (matchesForEdition.length > 0) {
        const { error: eventsError } = await supabase
          .from("match_events")
          .delete()
          .in("match_id", matchesForEdition);
        if (eventsError) throw eventsError;
        const { error: matchesError } = await supabase
          .from("matches")
          .delete()
          .in("id", matchesForEdition);
        if (matchesError) throw matchesError;
      }

      if (teamsForEdition.length > 0) {
        const { error: teamsError } = await supabase
          .from("teams")
          .delete()
          .in("id", teamsForEdition);
        if (teamsError) throw teamsError;
      }

      const { error: editionError } = await supabase.from("editions").delete().eq("id", id);
      if (editionError) throw editionError;
    },
    onSuccess: () => {
      invalidate();
      setSelectedEditionId("");
      toast.success("Edição e histórico removidos.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const createEdition = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      const y = Number(year);
      if (!n || n.length > 60) throw new Error("Informe o nome da edição");
      if (!Number.isInteger(y) || y < 1900 || y > 2200) throw new Error("Ano inválido");
      const { data, error } = await supabase
        .from("editions")
        .insert({ name: n, year: y })
        .select("id, name, year")
        .single();
      if (error) throw error;
      return data as { id: string; name: string; year: number } | null;
    },
    onSuccess: (createdEdition) => {
      if (!createdEdition) {
        toast.error("Não foi possível carregar a edição criada.");
        return;
      }
      const createdRecord: Edition = {
        id: createdEdition.id,
        name: createdEdition.name,
        year: createdEdition.year,
        is_active: false,
        foul_shootout_limit: 6,
        yellows_for_suspension: 3,
        games_to_reset_yellows: 0,
        suspension_games_yellow: 1,
        suspension_games_red: 1,
        team_count: 14,
        ouro_qualifiers: 4,
        prata_qualifiers: 3,
        logo_url: null,
        story_background_url: null,
        ad_enabled: false,
        ad_banner_url: null,
        ad_whatsapp_phone: null,
      };
      qc.setQueryData(["editions"], (previous: Edition[] | undefined) => {
        const next = [...(previous ?? [])];
        const existingIndex = next.findIndex((item) => item.id === createdRecord.id);
        if (existingIndex >= 0) {
          next[existingIndex] = createdRecord;
        } else {
          next.push(createdRecord);
        }
        return next.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
      });
      setName("");
      openEdition(createdEdition.id);
      invalidate();
      toast.success("Edição criada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTeam = useMutation({
    mutationFn: async () => {
      if (!selectedEditionId) throw new Error("Selecione a edição antes de cadastrar um time");
      const name = teamName.trim();
      if (!name || name.length > 60) throw new Error("Informe um nome de time válido");
      const { error } = await supabase.from("teams").insert({
        name,
        group_name: null,
        edition_id: selectedEditionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTeamName("");
      invalidate();
      toast.success("Time cadastrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addTeamsBulk = useMutation({
    mutationFn: async () => {
      if (!selectedEditionId) throw new Error("Selecione a edição antes de cadastrar os times");
      const names = parseBulkTeamNames(bulkTeamNames);
      if (names.length === 0) throw new Error("Informe ao menos um nome de time");
      if (names.some((name) => name.length > 60))
        throw new Error("Um dos nomes de time é muito longo");

      const rows = names.map((name) => ({
        name,
        group_name: null,
        edition_id: selectedEditionId,
      }));
      const { error } = await supabase.from("teams").insert(rows);
      if (error) throw error;
      return names.length;
    },
    onSuccess: (count) => {
      setBulkTeamNames("");
      invalidate();
      toast.success(`${count} times cadastrados.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPlayer = useMutation({
    mutationFn: async () => {
      const name = playerName.trim();
      if (!name || name.length > 80) throw new Error("Informe o nome do jogador");
      if (!playerTeam) throw new Error("Selecione o time");
      const num = shirt.trim() === "" ? null : Number(shirt);
      if (num !== null && (Number.isNaN(num) || num < 1 || num > 99))
        throw new Error("Número da camisa inválido");
      const { error } = await supabase.from("players").insert({
        name,
        team_id: playerTeam,
        shirt_number: num,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setPlayerName("");
      setPlayerTeam("");
      setShirt("");
      invalidate();
      toast.success("Jogador cadastrado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPlayersBulk = useMutation({
    mutationFn: async () => {
      if (!playerTeam) throw new Error("Selecione o time antes de cadastrar os jogadores");
      const entries = parseBulkPlayers(bulkPlayers);
      if (entries.length === 0) throw new Error("Informe ao menos um jogador");
      if (entries.some((entry) => entry.name.length > 80))
        throw new Error("Um nome de jogador é muito longo");

      const rows = entries.map((entry) => ({
        name: entry.name,
        team_id: playerTeam,
        shirt_number: entry.shirtNumber,
      }));

      const { error } = await supabase.from("players").insert(rows);
      if (error) throw error;
      return entries.length;
    },
    onSuccess: (count) => {
      setBulkPlayers("");
      invalidate();
      toast.success(`${count} jogadores cadastrados.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addEventDate = () => {
    if (!newEventDate) return;
    setEventDates((prev) => (prev.includes(newEventDate) ? prev : [...prev, newEventDate].sort()));
    setNewEventDate("");
  };

  const removeEventDate = (date: string) => {
    setEventDates((prev) => prev.filter((d) => d !== date));
  };

  const addBlockedRange = () => {
    setBlockedRanges((prev) => [...prev, { start: "", end: "" }]);
  };

  const updateBlockedRange = (index: number, field: "start" | "end", value: string) => {
    setBlockedRanges((prev) =>
      prev.map((range, i) => (i === index ? { ...range, [field]: value } : range)),
    );
  };

  const removeBlockedRange = (index: number) => {
    setBlockedRanges((prev) => prev.filter((_, i) => i !== index));
  };

  const saveRules = useMutation({
    mutationFn: async () => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const num = (key: RuleKey, label: string) => {
        const value = Number(ruleValues[key]);
        if (!Number.isInteger(value) || value < 0 || value > 99)
          throw new Error(`Valor inválido: ${label}`);
        return value;
      };
      const { error } = await supabase
        .from("editions")
        .update({
          foul_shootout_limit: num("foul_shootout_limit", "Faltas para shoot out"),
          yellows_for_suspension: num("yellows_for_suspension", "Amarelos para suspensão"),
          games_to_reset_yellows: num("games_to_reset_yellows", "Jogos para zerar amarelos"),
          suspension_games_yellow: num("suspension_games_yellow", "Suspensão por amarelos"),
          suspension_games_red: num("suspension_games_red", "Suspensão por vermelho"),
        })
        .eq("id", selectedEditionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Regras salvas.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEditionLogo = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const ext = file.name.split(".").pop() || "png";
      const path = `tournament-logo/${selectedEditionId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("marketing")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("marketing").getPublicUrl(path);
      const { error } = await supabase
        .from("editions")
        .update({ logo_url: data.publicUrl })
        .eq("id", selectedEditionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Logo do torneio atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEditionBackground = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const ext = file.name.split(".").pop() || "png";
      const path = `story-background/${selectedEditionId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("marketing")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("marketing").getPublicUrl(path);
      const { error } = await supabase
        .from("editions")
        .update({ story_background_url: data.publicUrl })
        .eq("id", selectedEditionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Fundo das artes atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [sponsorName, setSponsorName] = useState("");

  const addSponsor = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const trimmed = sponsorName.trim();
      if (!trimmed) throw new Error("Informe o nome do patrocinador");
      const ext = file.name.split(".").pop() || "png";
      const path = `sponsors/${selectedEditionId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("marketing")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("marketing").getPublicUrl(path);
      const { error } = await supabase.from("sponsors").insert({
        edition_id: selectedEditionId,
        name: trimmed,
        logo_url: data.publicUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setSponsorName("");
      invalidate();
      toast.success("Patrocinador adicionado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSponsor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sponsors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Patrocinador removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setMasterSponsor = useMutation({
    mutationFn: async (id: string) => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const off = await supabase
        .from("sponsors")
        .update({ is_master: false })
        .eq("edition_id", selectedEditionId);
      if (off.error) throw off.error;
      const { error } = await supabase.from("sponsors").update({ is_master: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Patrocinador master definido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateAdBanner = useMutation({
    mutationFn: async (file: File) => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const ext = file.name.split(".").pop() || "png";
      const path = `ad-banner/${selectedEditionId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("marketing")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("marketing").getPublicUrl(path);
      const { error } = await supabase
        .from("editions")
        .update({ ad_banner_url: data.publicUrl })
        .eq("id", selectedEditionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Banner do anúncio atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAdSettings = useMutation({
    mutationFn: async () => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const { error } = await supabase
        .from("editions")
        .update({ ad_whatsapp_phone: adPhone.trim() || null })
        .eq("id", selectedEditionId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("WhatsApp do anúncio salvo.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAdEnabled = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!selectedEditionId) throw new Error("Selecione a edição");
      const { error } = await supabase
        .from("editions")
        .update({ ad_enabled: enabled })
        .eq("id", selectedEditionId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const draw = useMutation({
    mutationFn: async () => {
      if (!selectedEditionId) throw new Error("Selecione a edição do campeonato");
      const g = Number(groupCount);
      if (!Number.isInteger(g) || g < 1 || g > 8) throw new Error("Número de grupos entre 1 e 8");
      const pool = shuffle((teams ?? []).filter((team) => team.edition_id === selectedEditionId));
      if (pool.length < 4) throw new Error("Cadastre pelo menos 4 times nesta edição");
      if (g > pool.length)
        throw new Error("Número de grupos não pode ser maior que o número de times");
      if (eventDates.length === 0) throw new Error("Selecione ao menos uma data do evento");
      const sortedDates = [...eventDates].sort();
      const step = Number(intervalMin);
      if (!Number.isInteger(step) || step < 10 || step > 480)
        throw new Error("Intervalo entre jogos inválido");
      const dayStart = dayStartTime.trim();
      const dayEnd = dayEndTime.trim();
      const dayStartMinutes = parseClock(dayStart);
      const dayEndMinutes = parseClock(dayEnd);
      if (dayEndMinutes <= dayStartMinutes)
        throw new Error("O período final deve ser depois do período inicial");
      const blockedWindows = blockedRanges
        .filter((range) => range.start.trim() !== "" || range.end.trim() !== "")
        .map((range) => {
          const start = parseClock(range.start, "Horário bloqueado");
          const end = parseClock(range.end, "Horário bloqueado");
          if (end <= start)
            throw new Error("O fim de um horário bloqueado deve ser depois do início");
          return { start, end };
        });
      const fieldList = fields
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean);
      if (fieldList.length === 0) throw new Error("Informe ao menos um campo");

      const buckets: { group: string; teamIds: string[]; names: string[] }[] = Array.from(
        { length: g },
        (_, i) => ({ group: GROUP_LETTERS[i]!, teamIds: [], names: [] }),
      );
      // Distribuição round-robin: nenhum time fica de fora e a diferença entre
      // o maior e o menor grupo nunca passa de 1 time quando não é divisível.
      pool.forEach((team, index) => {
        const bucket = buckets[index % g]!;
        bucket.teamIds.push(team.id);
        bucket.names.push(team.name);
      });

      for (const bucket of buckets) {
        const { error } = await supabase
          .from("teams")
          .update({ group_name: bucket.group })
          .in("id", bucket.teamIds);
        if (error) throw error;
      }

      // Times mudaram de grupo: os playoffs antigos (se existirem) não fazem
      // mais sentido e precisam ser gerados de novo depois que os grupos terminarem.
      const oldIds = (matches ?? [])
        .filter(
          (match) =>
            ["grupos", "oitavas", "quartas", "semi", "terceiro", "final"].includes(match.phase) &&
            match.edition_id === selectedEditionId,
        )
        .map((match) => match.id);
      if (oldIds.length > 0) {
        const { error: eventsError } = await supabase
          .from("match_events")
          .delete()
          .in("match_id", oldIds);
        if (eventsError) throw eventsError;
        const { error: oldMatchesError } = await supabase.from("matches").delete().in("id", oldIds);
        if (oldMatchesError) throw oldMatchesError;
      }

      const rows: Array<{
        phase: "grupos";
        group_name: string | null;
        kickoff_at: string;
        field: string;
        home_team_id: string;
        away_team_id: string;
        edition_id: string;
      }> = [];

      const scheduler = createScheduler({
        sortedDates,
        dayStartMinutes,
        dayEndMinutes,
        blockedWindows,
        fields: fieldList,
        stepMinutes: step,
      });

      const addMatch = (group: string, home: string, away: string) => {
        const { kickoff, field } = scheduler.next();
        rows.push({
          phase: "grupos",
          group_name: group,
          kickoff_at: kickoff.toISOString(),
          field,
          home_team_id: home,
          away_team_id: away,
          edition_id: selectedEditionId,
        });
      };

      // Cada grupo gera suas próprias rodadas pelo método do círculo (nenhum
      // time joga duas vezes na mesma rodada). As rodadas de todos os grupos
      // avançam em sequência (rodada 1 de todos os grupos, depois rodada 2,
      // ...), e cada rodada fecha o horário mesmo com campo ocioso — assim
      // nenhum time é sorteado para dois jogos no mesmo horário, e os jogos
      // de cada time ficam espaçados de forma praticamente igual.
      const bucketRounds = buckets.map((bucket) => ({
        group: bucket.group,
        rounds: roundRobinRounds(bucket.teamIds),
      }));
      const maxRounds = bucketRounds.reduce((max, b) => Math.max(max, b.rounds.length), 0);

      for (let r = 0; r < maxRounds; r++) {
        for (const bucket of bucketRounds) {
          const roundMatches = bucket.rounds[r] ?? [];
          for (const [home, away] of roundMatches) {
            addMatch(bucket.group, home, away);
          }
        }
        scheduler.finishRound();
      }

      saveStoredSchedule(selectedEditionId, {
        eventDates: sortedDates,
        dayStartTime: dayStart,
        dayEndTime: dayEnd,
        blockedRanges,
      });

      const { error } = await supabase.from("matches").insert(rows);
      if (error) throw error;

      setPreview(buckets.map((bucket) => ({ group: bucket.group, names: bucket.names })));
      return rows.length;
    },
    onSuccess: (count) => {
      invalidate();
      toast.success(`Sorteio realizado: ${count} jogos da fase de grupos gerados.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generatePlayoffs = useMutation({
    mutationFn: async () => {
      if (!selectedEditionId) throw new Error("Selecione a edição do campeonato");
      if (groupStandings.length < 2) {
        throw new Error("Os playoffs automáticos exigem times em pelo menos 2 grupos");
      }
      if (groupStandings.some((g) => !g.complete)) {
        throw new Error("Encerre todos os jogos da fase de grupos antes de gerar os playoffs");
      }
      const gold = Number(ouroSpots);
      const silver = Number(prataSpots);
      if (!Number.isInteger(gold) || gold < 1)
        throw new Error("Quantidade para Série Ouro inválida");
      if (!Number.isInteger(silver) || silver < 1)
        throw new Error("Quantidade para Série Prata inválida");
      // Ouro + Prata podem ultrapassar o tamanho do grupo (ex.: grupo pequeno com muitas
      // vagas configuradas) — os times do meio da tabela simplesmente disputam as duas
      // séries. Os playoffs são gerados normalmente com os times realmente classificados.

      // Plano do chaveamento inteiro (quartas, semi e final das duas séries — sem disputa
      // de 3º lugar), considerando os resultados já lançados. Cada clique sincroniza: cria
      // as partidas recém-liberadas (ex.: semi assim que as duas quartas que a alimentam
      // terminam) sem mexer nas que já existem ou já têm resultado.
      const plan = bracketMatchPlan({
        standings: groupStandings,
        ouroSpots: gold,
        prataSpots: silver,
        matches: editionMatches,
        editionId: selectedEditionId,
      });
      if (plan.length === 0) {
        throw new Error("Não foi possível determinar os confrontos — confira o formato salvo");
      }

      // Partidas de playoff que não fazem mais parte do plano atual (ex.: formato mudou
      // antes de qualquer jogo começar) são substituídas; jogos já iniciados, encerrados
      // ou com lançamentos na súmula nunca são apagados automaticamente.
      const planMatchIds = new Set(
        plan
          .filter((entry) => entry.existingMatchId)
          .map((entry) => entry.existingMatchId as string),
      );
      const staleIds = editionMatches
        .filter(
          (match) =>
            ["oitavas", "quartas", "semi", "terceiro", "final"].includes(match.phase) &&
            match.status === "agendada" &&
            !(events ?? []).some((event) => event.match_id === match.id) &&
            !planMatchIds.has(match.id),
        )
        .map((match) => match.id);
      if (staleIds.length > 0) {
        const { error: oldMatchesError } = await supabase
          .from("matches")
          .delete()
          .in("id", staleIds);
        if (oldMatchesError) throw oldMatchesError;
      }

      const toCreate = plan.filter((entry) => !entry.existingMatchId);
      if (toCreate.length === 0) return 0;

      const fieldList = fields
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean);
      if (fieldList.length === 0) throw new Error("Informe ao menos um campo");
      if (!playoffDate.trim()) throw new Error("Informe a data dos playoffs");
      const step = Number(playoffIntervalMin);
      if (!Number.isInteger(step) || step < 10 || step > 480)
        throw new Error("Intervalo entre jogos inválido");
      const dayStartMinutes = parseClock(playoffStartTime.trim(), "Horário de início");

      const scheduler = createScheduler({
        sortedDates: [playoffDate],
        dayStartMinutes,
        dayEndMinutes: 23 * 60 + 59,
        blockedWindows: [],
        fields: fieldList,
        stepMinutes: step,
      });

      const rows = toCreate.map((entry) => {
        const { kickoff, field } = scheduler.next();
        return {
          phase: entry.phase,
          group_name: entry.series,
          kickoff_at: kickoff.toISOString(),
          field,
          home_team_id: entry.homeTeamId,
          away_team_id: entry.awayTeamId,
          edition_id: selectedEditionId,
        };
      });

      const { error } = await supabase.from("matches").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      invalidate();
      setPlayoffDialogOpen(false);
      toast.success(
        count > 0
          ? `Playoffs atualizados: ${count} jogo(s) criados a partir da classificação e dos resultados já lançados. Já disponíveis para o mesário.`
          : "Playoffs já estão em dia — nenhum confronto novo foi liberado ainda.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTeam = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmed = name.trim();
      if (!trimmed || trimmed.length > 60) throw new Error("Informe um nome de time válido");
      const { error } = await supabase.from("teams").update({ name: trimmed }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingTeamId(null);
      setEditingTeamName("");
      invalidate();
      toast.success("Time atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTeamLogo = useMutation({
    mutationFn: async ({ teamId, file }: { teamId: string; file: File }) => {
      const ext = file.name.split(".").pop() || "png";
      const path = `${teamId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("team-logos")
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("team-logos").getPublicUrl(path);
      const { error } = await supabase
        .from("teams")
        .update({ logo_url: data.publicUrl })
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Logo do time atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPlayerToTeam = useMutation({
    mutationFn: async ({
      teamId,
      name,
      shirtValue,
    }: {
      teamId: string;
      name: string;
      shirtValue: string;
    }) => {
      const trimmedName = name.trim();
      if (!trimmedName || trimmedName.length > 80) throw new Error("Informe o nome do atleta");
      const num = shirtValue.trim() === "" ? null : Number(shirtValue);
      if (num !== null && (Number.isNaN(num) || num < 1 || num > 99))
        throw new Error("Número da camisa inválido");
      const { error } = await supabase.from("players").insert({
        name: trimmedName,
        team_id: teamId,
        shirt_number: num,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTeamEditorPlayerName("");
      setTeamEditorShirt("");
      invalidate();
      toast.success("Atleta adicionado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePlayer = useMutation({
    mutationFn: async ({
      id,
      name,
      shirtValue,
    }: {
      id: string;
      name: string;
      shirtValue: string;
    }) => {
      const trimmedName = name.trim();
      if (!trimmedName || trimmedName.length > 80) throw new Error("Informe o nome do atleta");
      const num = shirtValue.trim() === "" ? null : Number(shirtValue);
      if (num !== null && (Number.isNaN(num) || num < 1 || num > 99))
        throw new Error("Número da camisa inválido");
      const { error } = await supabase
        .from("players")
        .update({
          name: trimmedName,
          shirt_number: num,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingPlayerId(null);
      setEditingPlayerName("");
      setEditingPlayerShirt("");
      invalidate();
      toast.success("Atleta atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTeam = useMutation({
    mutationFn: async (id: string) => {
      const { error: playersError } = await supabase.from("players").delete().eq("team_id", id);
      if (playersError) throw playersError;
      const { error: teamError } = await supabase.from("teams").delete().eq("id", id);
      if (teamError) throw teamError;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Time removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePlayer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("players").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Jogador removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activate = useMutation({
    mutationFn: async (id: string) => {
      const off = await supabase.from("editions").update({ is_active: false }).neq("id", id);
      if (off.error) throw off.error;
      const { error } = await supabase.from("editions").update({ is_active: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Edição ativada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-stencil flex items-center gap-2 text-4xl font-bold">
        <Trophy className="size-8 text-primary" /> Edição do campeonato
      </h1>
      <p className="mt-1 text-muted-foreground">
        Gerencie edições, times e atletas, e configure a edição ativa para o mesário iniciar.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-5">
          <h2 className="text-stencil text-lg font-bold">Nova edição</h2>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="en">Nome</Label>
              <Input
                id="en"
                placeholder="Interclássicos 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ey">Ano</Label>
              <Input id="ey" value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <Button
              className="w-full"
              onClick={() => createEdition.mutate()}
              disabled={createEdition.isPending}
            >
              Criar edição
            </Button>
          </div>

          <ul className="mt-5 space-y-2">
            {(editions ?? []).map((ed) => (
              <li
                key={ed.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-secondary/60 px-3 py-2"
              >
                <span className="text-sm font-semibold">
                  {ed.name} · {ed.year}
                </span>
                <div className="flex items-center gap-2">
                  {ed.is_active ? (
                    <Badge>Ativa</Badge>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => activate.mutate(ed.id)}>
                      Ativar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={selectedEditionId === ed.id ? "secondary" : "ghost"}
                    onClick={() => openEdition(ed.id)}
                  >
                    {selectedEditionId === ed.id ? "Gerenciando" : "Gerenciar"}
                  </Button>
                </div>
              </li>
            ))}
            {(editions ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">Nenhuma edição criada ainda.</li>
            )}
          </ul>
        </section>

        {selectedEdition && (
          <section className="surface-card p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-stencil text-lg font-bold">Gerenciar edição</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Times, atletas, regras e sorteio desta edição. Só é possível configurar regras e
                  sorteio de uma edição aberta aqui.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <strong>{selectedEdition.name}</strong> · {selectedEdition.year}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedEdition.is_active ? (
                  <Badge>Ativa</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => activate.mutate(selectedEdition.id)}
                    disabled={activate.isPending}
                  >
                    Ativar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={closeEdition}>
                  Fechar
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => deleteEdition.mutate(selectedEdition.id)}
                  disabled={deleteEdition.isPending}
                >
                  Excluir edição
                </Button>
              </div>
            </div>

            <Tabs
              value={manageTab}
              onValueChange={(value) => setManageTab(value as "teams" | "setup")}
              className="mt-6"
            >
              <TabsList>
                <TabsTrigger value="teams">Times e atletas</TabsTrigger>
                <TabsTrigger value="setup">Regras e sorteio</TabsTrigger>
              </TabsList>

              <TabsContent value="teams" className="mt-6">
                <div className="mt-6 grid gap-6 lg:grid-cols-3">
                  <div className="rounded-lg bg-secondary/40 p-4">
                    <h3 className="text-stencil text-sm font-bold">Times</h3>
                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="team-name">Nome do time</Label>
                        <Input
                          id="team-name"
                          value={teamName}
                          onChange={(e) => setTeamName(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={() => addTeam.mutate()}>
                        Incluir time
                      </Button>

                      <div className="space-y-1.5 border-t border-border/50 pt-3">
                        <Label htmlFor="bulk-team-names">Vários times (cole do Excel)</Label>
                        <Textarea
                          id="bulk-team-names"
                          rows={6}
                          placeholder="Ex.: Flamengo\nCorinthians\nPalmeiras\nou Flamengo, Corinthians, Palmeiras"
                          value={bulkTeamNames}
                          onChange={(e) => setBulkTeamNames(e.target.value)}
                        />
                        <Button
                          className="w-full"
                          onClick={() => addTeamsBulk.mutate()}
                          disabled={addTeamsBulk.isPending}
                        >
                          Adicionar vários times
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/40 p-4">
                    <h3 className="text-stencil text-sm font-bold">Jogadores</h3>
                    <div className="mt-4 space-y-3">
                      <div className="space-y-1.5">
                        <Label>Time</Label>
                        <Select value={playerTeam} onValueChange={setPlayerTeam}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {editionTeams.map((team) => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="player-name">Nome do jogador</Label>
                        <Input
                          id="player-name"
                          value={playerName}
                          onChange={(e) => setPlayerName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="player-shirt">Camisa</Label>
                        <Input
                          id="player-shirt"
                          inputMode="numeric"
                          value={shirt}
                          onChange={(e) => setShirt(e.target.value)}
                        />
                      </div>
                      <Button className="w-full" onClick={() => addPlayer.mutate()}>
                        Incluir jogador
                      </Button>

                      <div className="space-y-1.5 border-t border-border/50 pt-3">
                        <Label htmlFor="bulk-players">Vários jogadores (cole do Excel)</Label>
                        <Textarea
                          id="bulk-players"
                          rows={6}
                          placeholder="Ex.: João Silva 10\nMaria Souza 7\nou João Silva;10"
                          value={bulkPlayers}
                          onChange={(e) => setBulkPlayers(e.target.value)}
                        />
                        <Button
                          className="w-full"
                          onClick={() => addPlayersBulk.mutate()}
                          disabled={addPlayersBulk.isPending}
                        >
                          Adicionar vários jogadores
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-secondary/40 p-4">
                    <h3 className="text-stencil text-sm font-bold">Times e atletas</h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold">Times cadastrados</h4>
                        {editionTeams.length === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Nenhum time nesta edição.
                          </p>
                        ) : (
                          <ul className="mt-3 space-y-2">
                            {editionTeams.map((team) => {
                              const teamPlayers = editionPlayers.filter(
                                (player) => player.team_id === team.id,
                              );
                              const isEditingTeam = editingTeamId === team.id;
                              return (
                                <li key={team.id} className="rounded-md bg-background px-3 py-2">
                                  {isEditingTeam ? (
                                    <div className="space-y-3">
                                      <div className="space-y-1.5">
                                        <Label htmlFor={`edit-team-${team.id}`}>Nome do time</Label>
                                        <Input
                                          id={`edit-team-${team.id}`}
                                          value={editingTeamName}
                                          onChange={(e) => setEditingTeamName(e.target.value)}
                                        />
                                      </div>
                                      <div className="space-y-1.5">
                                        <Label htmlFor={`edit-team-logo-${team.id}`}>
                                          Logo do time
                                        </Label>
                                        <div className="flex items-center gap-3">
                                          <TeamCrest logoUrl={team.logo_url} name={team.name} size="lg" />
                                          <Input
                                            id={`edit-team-logo-${team.id}`}
                                            type="file"
                                            accept="image/*"
                                            disabled={updateTeamLogo.isPending}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) updateTeamLogo.mutate({ teamId: team.id, file });
                                              e.target.value = "";
                                            }}
                                          />
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          onClick={() =>
                                            updateTeam.mutate({
                                              id: team.id,
                                              name: editingTeamName,
                                            })
                                          }
                                          disabled={updateTeam.isPending}
                                        >
                                          Salvar time
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => {
                                            setEditingTeamId(null);
                                            setEditingTeamName("");
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>

                                      <div className="rounded-md border border-border/50 p-3">
                                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          Incluir atleta
                                        </h5>
                                        <div className="mt-2 space-y-2">
                                          <Input
                                            placeholder="Nome do atleta"
                                            value={teamEditorPlayerName}
                                            onChange={(e) =>
                                              setTeamEditorPlayerName(e.target.value)
                                            }
                                          />
                                          <Input
                                            placeholder="Camisa"
                                            inputMode="numeric"
                                            value={teamEditorShirt}
                                            onChange={(e) => setTeamEditorShirt(e.target.value)}
                                          />
                                          <Button
                                            size="sm"
                                            className="w-full"
                                            onClick={() =>
                                              addPlayerToTeam.mutate({
                                                teamId: team.id,
                                                name: teamEditorPlayerName,
                                                shirtValue: teamEditorShirt,
                                              })
                                            }
                                            disabled={addPlayerToTeam.isPending}
                                          >
                                            Adicionar atleta
                                          </Button>
                                        </div>
                                      </div>

                                      <div>
                                        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                          Atletas do time
                                        </h5>
                                        {teamPlayers.length === 0 ? (
                                          <p className="mt-2 text-sm text-muted-foreground">
                                            Nenhum atleta neste time.
                                          </p>
                                        ) : (
                                          <ul className="mt-2 space-y-2">
                                            {teamPlayers.map((player) => {
                                              const isEditingPlayer = editingPlayerId === player.id;
                                              return (
                                                <li
                                                  key={player.id}
                                                  className="rounded-md bg-secondary/40 px-2 py-2"
                                                >
                                                  {isEditingPlayer ? (
                                                    <div className="space-y-2">
                                                      <Input
                                                        value={editingPlayerName}
                                                        onChange={(e) =>
                                                          setEditingPlayerName(e.target.value)
                                                        }
                                                      />
                                                      <Input
                                                        inputMode="numeric"
                                                        value={editingPlayerShirt}
                                                        onChange={(e) =>
                                                          setEditingPlayerShirt(e.target.value)
                                                        }
                                                      />
                                                      <div className="flex gap-2">
                                                        <Button
                                                          size="sm"
                                                          onClick={() =>
                                                            updatePlayer.mutate({
                                                              id: player.id,
                                                              name: editingPlayerName,
                                                              shirtValue: editingPlayerShirt,
                                                            })
                                                          }
                                                          disabled={updatePlayer.isPending}
                                                        >
                                                          Salvar atleta
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          variant="ghost"
                                                          onClick={() => {
                                                            setEditingPlayerId(null);
                                                            setEditingPlayerName("");
                                                            setEditingPlayerShirt("");
                                                          }}
                                                        >
                                                          Cancelar
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="flex items-center justify-between gap-2">
                                                      <div className="text-sm">
                                                        {player.name}
                                                        {player.shirt_number
                                                          ? ` • #${player.shirt_number}`
                                                          : ""}
                                                      </div>
                                                      <div className="flex gap-1">
                                                        <Button
                                                          size="sm"
                                                          variant="secondary"
                                                          onClick={() => {
                                                            setEditingPlayerId(player.id);
                                                            setEditingPlayerName(player.name);
                                                            setEditingPlayerShirt(
                                                              player.shirt_number
                                                                ? String(player.shirt_number)
                                                                : "",
                                                            );
                                                          }}
                                                        >
                                                          Editar
                                                        </Button>
                                                        <Button
                                                          size="sm"
                                                          variant="destructive"
                                                          onClick={() =>
                                                            deletePlayer.mutate(player.id)
                                                          }
                                                          disabled={deletePlayer.isPending}
                                                        >
                                                          Excluir
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  )}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        )}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="flex items-center gap-2 text-sm">
                                        <TeamCrest logoUrl={team.logo_url} name={team.name} />
                                        {team.name}
                                      </span>
                                      <div className="flex gap-1">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => {
                                            setEditingTeamId(team.id);
                                            setEditingTeamName(team.name);
                                            setTeamEditorPlayerName("");
                                            setTeamEditorShirt("");
                                          }}
                                        >
                                          Editar
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => deleteTeam.mutate(team.id)}
                                          disabled={deleteTeam.isPending}
                                        >
                                          Excluir
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="setup" className="mt-6">
                <div className="grid gap-6 lg:grid-cols-2">
                  <section className="rounded-lg bg-secondary/40 p-4">
                    <h3 className="text-stencil text-sm font-bold">Regras do torneio</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Atualize as regras que serão aplicadas no painel do mesário.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {RULE_FIELDS.map((field) => (
                        <div key={field.key} className="space-y-1.5">
                          <Label htmlFor={field.key}>{field.label}</Label>
                          <Input
                            id={field.key}
                            inputMode="numeric"
                            value={ruleValues[field.key]}
                            onChange={(e) =>
                              setRuleValues({ ...ruleValues, [field.key]: e.target.value })
                            }
                          />
                          <p className="text-xs text-muted-foreground">{field.hint}</p>
                        </div>
                      ))}
                    </div>
                    <Button
                      className="mt-4 w-full"
                      onClick={() => saveRules.mutate()}
                      disabled={saveRules.isPending}
                    >
                      Salvar regras
                    </Button>

                    <div className="mt-6 border-t border-border/50 pt-4">
                      <Label htmlFor="edition-logo">Logo do torneio</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Usado nas artes automáticas geradas na aba Marketing.
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <TeamCrest
                          logoUrl={selectedEdition?.logo_url}
                          name={selectedEdition?.name ?? "?"}
                          size="lg"
                        />
                        <Input
                          id="edition-logo"
                          type="file"
                          accept="image/*"
                          disabled={!selectedEditionId || updateEditionLogo.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) updateEditionLogo.mutate(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 border-t border-border/50 pt-4">
                      <Label htmlFor="edition-background">Fundo das artes (Stories)</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Imagem de fundo usada nas artes de resultado e de craque da partida
                        geradas na aba Marketing. Formato retrato (ex.: 1080×1920).
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        {selectedEdition?.story_background_url ? (
                          <img
                            src={selectedEdition.story_background_url}
                            alt="Fundo das artes"
                            className="h-16 w-9 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-16 w-9 rounded-md bg-secondary" />
                        )}
                        <Input
                          id="edition-background"
                          type="file"
                          accept="image/*"
                          disabled={!selectedEditionId || updateEditionBackground.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) updateEditionBackground.mutate(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-6 border-t border-border/50 pt-4">
                      <Label>Patrocinadores</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Aparecem na barra inferior da arte do craque da partida. O patrocinador
                        master aparece em destaque.
                      </p>
                      <ul className="mt-3 space-y-2">
                        {(sponsors ?? [])
                          .filter((s) => s.edition_id === selectedEditionId)
                          .map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2"
                            >
                              <span className="flex items-center gap-2 text-sm">
                                <TeamCrest logoUrl={s.logo_url} name={s.name} />
                                {s.name}
                                {s.is_master && (
                                  <Badge className="ml-1">Master</Badge>
                                )}
                              </span>
                              <div className="flex gap-1">
                                {!s.is_master && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => setMasterSponsor.mutate(s.id)}
                                    disabled={setMasterSponsor.isPending}
                                  >
                                    Definir master
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteSponsor.mutate(s.id)}
                                  disabled={deleteSponsor.isPending}
                                >
                                  Excluir
                                </Button>
                              </div>
                            </li>
                          ))}
                        {(sponsors ?? []).filter((s) => s.edition_id === selectedEditionId)
                          .length === 0 && (
                          <p className="text-sm text-muted-foreground">
                            Nenhum patrocinador cadastrado.
                          </p>
                        )}
                      </ul>

                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder="Nome do patrocinador"
                          value={sponsorName}
                          onChange={(e) => setSponsorName(e.target.value)}
                        />
                        <Input
                          type="file"
                          accept="image/*"
                          disabled={!selectedEditionId || addSponsor.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) addSponsor.mutate(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </div>
                  </section>

                  <section className="rounded-lg bg-secondary/40 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-stencil text-sm font-bold">Anúncio pago</h3>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="ad-enabled" className="text-xs text-muted-foreground">
                          Ativo
                        </Label>
                        <Switch
                          id="ad-enabled"
                          checked={selectedEdition?.ad_enabled ?? false}
                          disabled={!selectedEditionId || toggleAdEnabled.isPending}
                          onCheckedChange={(checked) => toggleAdEnabled.mutate(checked)}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mostrado uma única vez para visitantes que não são admin/mesário, com um
                      link direto pro WhatsApp pedindo orçamento.
                    </p>

                    <div className="mt-4 space-y-1.5">
                      <Label htmlFor="ad-banner">Banner do anúncio</Label>
                      <div className="flex items-center gap-3">
                        {selectedEdition?.ad_banner_url ? (
                          <img
                            src={selectedEdition.ad_banner_url}
                            alt="Banner do anúncio"
                            className="h-16 w-16 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-16 w-16 rounded-md bg-background" />
                        )}
                        <Input
                          id="ad-banner"
                          type="file"
                          accept="image/*"
                          disabled={!selectedEditionId || updateAdBanner.isPending}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) updateAdBanner.mutate(file);
                            e.target.value = "";
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-1.5">
                        <Label htmlFor="ad-phone">WhatsApp (com DDI e DDD)</Label>
                        <Input
                          id="ad-phone"
                          placeholder="5548999999999"
                          inputMode="numeric"
                          value={adPhone}
                          onChange={(e) => setAdPhone(e.target.value)}
                        />
                      </div>
                      <Button
                        onClick={() => saveAdSettings.mutate()}
                        disabled={!selectedEditionId || saveAdSettings.isPending}
                      >
                        Salvar WhatsApp
                      </Button>
                    </div>
                  </section>

                  <section className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-primary">Visão do formato</span>
                      <Badge variant="secondary">{editionTeamCount} times</Badge>
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                      <div className="rounded-md bg-background/70 p-3">
                        <p className="font-semibold text-foreground">Fase de grupos</p>
                        <p className="mt-1">
                          Os times são divididos em grupos e jogam turno único dentro do próprio
                          grupo.
                        </p>
                      </div>
                      <div className="rounded-md bg-background/70 p-3">
                        <p className="font-semibold text-foreground">Série Ouro</p>
                        <p className="mt-1">
                          Os {ouroSpots} melhores times avançam para a disputa da Série Ouro.
                        </p>
                      </div>
                      <div className="rounded-md bg-background/70 p-3">
                        <p className="font-semibold text-foreground">Série Prata</p>
                        <p className="mt-1">
                          Os {prataSpots} últimos colocados seguem para a disputa da Série Prata.
                        </p>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="surface-card p-5 mt-6">
                  <h2 className="text-stencil text-lg font-bold">Resumo visual do campeonato</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Os times participantes são contados automaticamente a partir da aba Times e
                    atletas. Ajuste os classificados para Ouro e Prata, salve o formato e gere os
                    playoffs quando a fase de grupos terminar.
                  </p>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="team-count">Times participantes</Label>
                      <Input id="team-count" disabled value={`${editionTeamCount} (automático)`} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ouro-spots">Classificam para Ouro</Label>
                      <Input
                        id="ouro-spots"
                        inputMode="numeric"
                        value={ouroSpots}
                        onChange={(e) => setOuroSpots(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prata-spots">Classificam para Prata</Label>
                      <Input
                        id="prata-spots"
                        inputMode="numeric"
                        value={prataSpots}
                        onChange={(e) => setPrataSpots(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-4 w-full"
                    onClick={() => saveFormatConfig.mutate()}
                    disabled={saveFormatConfig.isPending}
                  >
                    Salvar formato
                  </Button>

                  <div className="mt-5 rounded-lg border border-border/60 bg-background/70 p-4">
                    <p className="text-sm font-semibold">
                      Playoffs (quartas) a partir da classificação real
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {groupStandings.length === 0 ? (
                        <span>sem times</span>
                      ) : (
                        groupStandings.map((g) => (
                          <span key={g.group}>
                            Grupo {g.group}: {g.complete ? "completo" : "em andamento"}
                          </span>
                        ))
                      )}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {groupsReadyForPlayoffs
                        ? "Os grupos terminaram. Gerar playoffs cria de uma vez todas as partidas de Ouro e Prata já decidíveis — quartas, semi e final, sem disputa de 3º lugar, assim que os jogos anteriores forem encerrados. Clique de novo a cada rodada concluída para liberar a próxima."
                        : "Aguardando todos os jogos da fase de grupos serem encerrados. Enquanto isso, o chaveamento na aba Partidas mostra vagas por posição."}
                    </p>
                    <Button
                      className="mt-3 w-full"
                      variant="secondary"
                      onClick={() => {
                        if (playoffDate.trim() === "") {
                          const lastEventDate = [...eventDates].sort().at(-1);
                          setPlayoffDate(lastEventDate ?? new Date().toISOString().slice(0, 10));
                        }
                        setPlayoffDialogOpen(true);
                      }}
                      disabled={generatePlayoffs.isPending || !groupsReadyForPlayoffs}
                    >
                      Gerar/Atualizar playoffs
                    </Button>
                  </div>
                </section>

                <Dialog open={playoffDialogOpen} onOpenChange={setPlayoffDialogOpen}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Gerar/Atualizar playoffs</DialogTitle>
                      <DialogDescription>
                        Informe a data, o horário de início e o intervalo entre os jogos. Todas as
                        partidas de Ouro e Prata já decidíveis (quartas e, conforme cada rodada for
                        encerrada, semi/final — sem disputa de 3º lugar) são criadas automaticamente
                        e já ficam disponíveis para o mesário.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="playoff-date">Data</Label>
                        <Input
                          id="playoff-date"
                          type="date"
                          value={playoffDate}
                          onChange={(e) => setPlayoffDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="playoff-start">Horário de início</Label>
                        <TimeField24
                          id="playoff-start"
                          value={playoffStartTime}
                          onChange={setPlayoffStartTime}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="playoff-interval">Intervalo entre jogos (min)</Label>
                        <Input
                          id="playoff-interval"
                          inputMode="numeric"
                          value={playoffIntervalMin}
                          onChange={(e) => setPlayoffIntervalMin(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setPlayoffDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button
                        onClick={() => generatePlayoffs.mutate()}
                        disabled={generatePlayoffs.isPending || !playoffDate}
                      >
                        {generatePlayoffs.isPending ? "Gerando..." : "Gerar/Atualizar playoffs"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <section className="surface-card p-5 mt-6">
                  <h2 className="text-stencil text-lg font-bold">Sorteio da fase de grupos</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Distribui os times cadastrados nos grupos e gera a tabela de jogos da fase de
                    grupos nas datas, campos e horários informados abaixo.
                  </p>
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="gc">Quantidade de grupos</Label>
                        <Input
                          id="gc"
                          value={groupCount}
                          onChange={(e) => setGroupCount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="iv">Intervalo entre jogos (minutos)</Label>
                        <Input
                          id="iv"
                          value={intervalMin}
                          onChange={(e) => setIntervalMin(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="ed">Datas do evento</Label>
                      <div className="flex gap-2">
                        <DateFieldBR id="ed" value={newEventDate} onChange={setNewEventDate} />
                        <Button type="button" variant="secondary" onClick={addEventDate}>
                          Adicionar data
                        </Button>
                      </div>
                      {eventDates.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Nenhuma data adicionada. Os jogos serão distribuídos apenas nas datas
                          informadas aqui.
                        </p>
                      ) : (
                        <ul className="flex flex-wrap gap-2 pt-1">
                          {eventDates.map((date) => (
                            <li key={date}>
                              <Badge variant="secondary" className="gap-2">
                                {formatDate(`${date}T00:00:00`)}
                                <button
                                  type="button"
                                  aria-label={`Remover ${date}`}
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() => removeEventDate(date)}
                                >
                                  ×
                                </button>
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="ds">Início do período diário</Label>
                        <TimeField24 id="ds" value={dayStartTime} onChange={setDayStartTime} />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="de">Fim do período diário</Label>
                        <TimeField24 id="de" value={dayEndTime} onChange={setDayEndTime} />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Horários sem jogos (ex.: pausa do almoço)</Label>
                      <div className="space-y-2">
                        {blockedRanges.map((range, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <TimeField24
                              ariaLabel="Início do bloqueio"
                              value={range.start}
                              onChange={(value) => updateBlockedRange(index, "start", value)}
                            />
                            <span className="text-sm text-muted-foreground">até</span>
                            <TimeField24
                              ariaLabel="Fim do bloqueio"
                              value={range.end}
                              onChange={(value) => updateBlockedRange(index, "end", value)}
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => removeBlockedRange(index)}
                            >
                              Remover
                            </Button>
                          </div>
                        ))}
                      </div>
                      <Button type="button" size="sm" variant="secondary" onClick={addBlockedRange}>
                        Adicionar horário sem jogos
                      </Button>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="fl">Campos (separados por vírgula)</Label>
                      <Input id="fl" value={fields} onChange={(e) => setFields(e.target.value)} />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => draw.mutate()}
                      disabled={draw.isPending}
                    >
                      Realizar sorteio
                    </Button>

                    {preview.length > 0 && (
                      <div className="mt-5 space-y-3">
                        {preview.map((groupPreview) => (
                          <div key={groupPreview.group} className="rounded-md bg-secondary/60 p-3">
                            <p className="text-stencil font-bold text-primary">
                              Grupo {groupPreview.group}
                            </p>
                            <ul className="mt-1 text-sm text-muted-foreground">
                              {groupPreview.names.map((name) => (
                                <li key={name}>{name}</li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </TabsContent>
            </Tabs>
          </section>
        )}
      </div>
    </main>
  );
}
