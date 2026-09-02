const WIDTH = 1080;
const HEIGHT = 1920;

const BG_TOP = "oklch(0.16 0.045 265)";
const BG_BOTTOM = "oklch(0.10 0.035 265)";
const PRIMARY = "oklch(0.62 0.17 258)";
const ACCENT = "oklch(0.74 0.14 235)";
const FG = "oklch(0.96 0.012 255)";
const MUTED = "oklch(0.78 0.02 255)";
const PANEL = "oklch(0.14 0.03 265 / 0.72)";
/** Mesma fonte usada na wordmark "Interclássicos" no resto do app (ver --font-display). */
const DISPLAY_FONT = '"Barlow Condensed", system-ui, sans-serif';

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Falha ao carregar imagem: ${url}`));
    img.src = url;
  });
}

async function tryLoadImage(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  try {
    return await loadImage(url);
  } catch {
    return null;
  }
}

/** Fundo: a imagem cadastrada da edição, preenchendo o Stories inteiro (sem barras vazias) e
 * ancorada no canto superior direito — onde normalmente fica o logo do torneio/patrocinador —
 * então o corte do enquadramento nunca cai em cima dele, só na área "neutra" da foto (o resto do
 * campo/estádio). Um véu escuro por cima garante que o texto leia bem em qualquer foto; sem
 * imagem cadastrada, cai no gradiente padrão da marca. */
function drawBackground(ctx: CanvasRenderingContext2D, bg: HTMLImageElement | null) {
  if (bg) {
    drawCoverImage(ctx, bg, 0, 0, WIDTH, HEIGHT, 0, 1, 0);

    const veil = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    veil.addColorStop(0, "oklch(0.08 0.03 265 / 0.5)");
    veil.addColorStop(0.45, "oklch(0.08 0.03 265 / 0.22)");
    veil.addColorStop(1, "oklch(0.05 0.03 265 / 0.7)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    return;
  }

  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, BG_TOP);
  gradient.addColorStop(1, BG_BOTTOM);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = PRIMARY;
  ctx.fillRect(0, 0, WIDTH, 14);
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 14, WIDTH, 6);
}

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/** Painel translúcido atrás do conteúdo — garante leitura do texto sobre uma foto de fundo. */
function drawPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  roundedRectPath(ctx, x, y, w, h, 36);
  ctx.fillStyle = PANEL;
  ctx.fill();
  ctx.restore();
}

/**
 * `anchorX`/`anchorY` (0 a 1) dizem de que lado o corte "sobra" — 0.5 é centralizado (padrão),
 * 1 preserva a borda direita/inferior inteira (corta só do lado esquerdo/topo) e 0 preserva a
 * borda esquerda/superior (corta só do lado direito/embaixo). Usado pro fundo dos Stories não
 * cortar um logo que fique perto de um canto específico da imagem original.
 */
function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  radius = 0,
  anchorX = 0.5,
  anchorY = 0.5,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) * anchorX;
  const sy = (img.height - sh) * anchorY;

  ctx.save();
  if (radius > 0) {
    roundedRectPath(ctx, x, y, w, h, radius);
    ctx.clip();
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function drawContainImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cx: number,
  cy: number,
  maxW: number,
  maxH: number,
) {
  const scale = Math.min(maxW / img.width, maxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, cx - w / 2, cy - h / 2, w, h);
  return { w, h };
}

function drawCrestCircle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  name: string,
  cx: number,
  cy: number,
  radius: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = "oklch(0.98 0.005 255)";
  ctx.fill();
  if (img) {
    ctx.clip();
    drawCoverImage(ctx, img, cx - radius, cy - radius, radius * 2, radius * 2);
  } else {
    ctx.fillStyle = "oklch(0.2 0.03 265)";
    ctx.font = `700 ${radius}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name.charAt(0).toUpperCase(), cx, cy + radius * 0.05);
  }
  ctx.restore();
  ctx.textBaseline = "alphabetic";
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const words = text.split(" ");
  let line = "";
  let cursorY = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, cursorY);
  return cursorY + lineHeight;
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Falha ao gerar a imagem"));
    }, "image/png");
  });
}

export type SponsorLogo = { logoUrl: string; isMaster: boolean };

const SPONSOR_BAR_BG = "oklch(0.98 0.005 255)";
const SPONSOR_BAR_TEXT = "oklch(0.2 0.03 265)";
const SPONSOR_MASTER_H = 120;
const SPONSOR_OTHER_H = 76;

/** Altura da faixa branca — sempre 10% da altura do Stories, com os logos contidos e
 * centralizados dentro dela (nada vaza pra fora). Usada tanto pra desenhar quanto pra reservar
 * espaço no layout do conteúdo acima, sem duplicar os números mágicos. */
function sponsorBarHeight(sponsors: SponsorLogo[], label?: string): number {
  if (sponsors.length === 0 && !label) return 0;
  return Math.round(HEIGHT * 0.1);
}

/** Faixa branca na base do Stories com os logos dos patrocinadores (na própria transparência do
 * PNG, sem chip por trás) sempre contidos e centralizados dentro dela. O patrocinador master
 * fica sempre no centro da fileira e maior que os demais. `label` opcional (ex.: "OFERECIMENTO")
 * aparece como um título centralizado acima dos logos. */
async function drawSponsorBar(ctx: CanvasRenderingContext2D, sponsors: SponsorLogo[], label?: string) {
  const barHeight = sponsorBarHeight(sponsors, label);
  if (barHeight === 0) return;
  const barY = HEIGHT - barHeight;

  ctx.save();
  ctx.fillStyle = SPONSOR_BAR_BG;
  ctx.fillRect(0, barY, WIDTH, barHeight);
  ctx.fillStyle = PRIMARY;
  ctx.fillRect(0, barY, WIDTH, 4);
  ctx.restore();

  if (sponsors.length === 0) {
    if (label) {
      ctx.textAlign = "left";
      ctx.fillStyle = SPONSOR_BAR_TEXT;
      ctx.font = `700 34px ${DISPLAY_FONT}`;
      ctx.fillText(label, 32, barY + barHeight / 2 + 12);
    }
    return;
  }

  const loaded = (
    await Promise.all(
      sponsors.map(async (s) => ({ img: await tryLoadImage(s.logoUrl), isMaster: s.isMaster })),
    )
  ).filter((s): s is { img: HTMLImageElement; isMaster: boolean } => s.img !== null);
  if (loaded.length === 0) return;

  // O master fica sempre no meio da fileira, com os demais patrocinadores nos dois lados.
  const master = loaded.find((s) => s.isMaster) ?? null;
  const others = loaded.filter((s) => s !== master);
  const half = Math.floor(others.length / 2);
  const ordered = master ? [...others.slice(0, half), master, ...others.slice(half)] : others;

  let rowCenterY: number;
  if (label) {
    ctx.textAlign = "left";
    ctx.fillStyle = SPONSOR_BAR_TEXT;
    ctx.font = `700 24px ${DISPLAY_FONT}`;
    ctx.fillText(label, 32, barY + 32);
    rowCenterY = barY + 44 + Math.max(SPONSOR_MASTER_H, SPONSOR_OTHER_H) / 2;
  } else {
    rowCenterY = barY + barHeight / 2;
  }

  const gap = 32;
  const heights = ordered.map((s) => (s.isMaster ? SPONSOR_MASTER_H : SPONSOR_OTHER_H));
  const widths = ordered.map((s, i) => (s.img.width / s.img.height) * heights[i]!);
  const totalWidth = widths.reduce((a, b) => a + b, 0) + gap * (ordered.length - 1);

  // Nunca deixa a fileira estourar a largura do Stories — se não coube, encolhe tudo
  // proporcionalmente (o master continua maior que os demais) em vez de cortar as pontas.
  const maxRowWidth = WIDTH - 80;
  const fit = totalWidth > maxRowWidth ? maxRowWidth / totalWidth : 1;

  let cx = WIDTH / 2 - (totalWidth * fit) / 2;

  ordered.forEach((s, i) => {
    const h = heights[i]! * fit;
    const w = widths[i]! * fit;
    drawContainImage(ctx, s.img, cx + w / 2, rowCenterY, w, h);
    cx += w + gap * fit;
  });
}

export type MatchStoryGoal = { playerName: string; minute: number | null };
export type MatchStoryTeamEvents = {
  goals: MatchStoryGoal[];
  redCards: { playerName: string }[];
};
export type MatchStoryParams = {
  backgroundUrl?: string | null | undefined;
  tournamentLogoUrl?: string | null | undefined;
  homeTeam: { name: string; logoUrl: string | null };
  awayTeam: { name: string; logoUrl: string | null };
  homeScore: number;
  awayScore: number;
  homeEvents: MatchStoryTeamEvents;
  awayEvents: MatchStoryTeamEvents;
  competitionLabel: string;
  sponsors?: SponsorLogo[];
};

export async function generateMatchStoryImage(params: MatchStoryParams): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  await document.fonts.ready;

  // Quando há fundo próprio cadastrado, ele já traz a marca do torneio — evita duplicar o logo.
  const tournamentLogoPromise = params.backgroundUrl
    ? Promise.resolve(null)
    : tryLoadImage(params.tournamentLogoUrl);
  const [background, tournamentLogo, homeLogo, awayLogo] = await Promise.all([
    tryLoadImage(params.backgroundUrl),
    tournamentLogoPromise,
    tryLoadImage(params.homeTeam.logoUrl),
    tryLoadImage(params.awayTeam.logoUrl),
  ]);

  drawBackground(ctx, background);

  const sponsors = params.sponsors ?? [];
  const barHeight = sponsorBarHeight(sponsors);

  // Painel de conteúdo: escudos + placar +, embaixo de cada escudo, os gols/expulsões daquele
  // time — sempre legível sobre a foto de fundo, sem passar por cima da barra de patrocinadores.
  const crestRadius = 120;
  const logoBlockH = tournamentLogo ? 90 : 0;
  const homeRows = params.homeEvents.goals.length + params.homeEvents.redCards.length;
  const awayRows = params.awayEvents.goals.length + params.awayEvents.redCards.length;
  const hasAnyEvent = homeRows + awayRows > 0;
  const listBlockH = hasAnyEvent ? Math.max(homeRows, awayRows) * 50 + 20 : 60;
  const panelH = 60 + logoBlockH + crestRadius * 2 + 70 + 90 + 70 + 50 + listBlockH + 50;
  const availableH = HEIGHT - barHeight;
  // Centralizado no post inteiro (não só no espaço acima da barra) — só recua se isso
  // empurrasse o painel pra cima da borda ou por cima da barra de patrocinadores.
  const panelTop = Math.min(Math.max(140, (HEIGHT - panelH) / 2), availableH - panelH - 20);
  const panelX = 56;
  const panelW = WIDTH - panelX * 2;

  drawPanel(ctx, panelX, panelTop, panelW, panelH);

  let y = panelTop + 60;

  if (tournamentLogo) {
    drawContainImage(ctx, tournamentLogo, WIDTH / 2, y, 220, 100);
    y += 90;
  }

  ctx.fillStyle = MUTED;
  ctx.font = `700 32px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(params.competitionLabel.toUpperCase(), WIDTH / 2, y);
  y += 60;

  const crestY = y + crestRadius;
  const homeX = WIDTH * 0.27;
  const awayX = WIDTH * 0.73;
  drawCrestCircle(ctx, homeLogo, params.homeTeam.name, homeX, crestY, crestRadius);
  drawCrestCircle(ctx, awayLogo, params.awayTeam.name, awayX, crestY, crestRadius);

  ctx.fillStyle = FG;
  ctx.font = `700 116px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.fillText(`${params.homeScore} : ${params.awayScore}`, WIDTH / 2, crestY + 40);

  y = crestY + crestRadius + 60;
  ctx.font = `700 40px ${DISPLAY_FONT}`;
  ctx.fillStyle = FG;
  ctx.fillText(params.homeTeam.name.toUpperCase(), homeX, y, 380);
  ctx.fillText(params.awayTeam.name.toUpperCase(), awayX, y, 380);

  y += 50;
  ctx.strokeStyle = "oklch(1 0 0 / 0.15)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(panelX + 40, y);
  ctx.lineTo(panelX + panelW - 40, y);
  ctx.stroke();
  y += 50;

  // Gols e expulsões de cada time ficam alinhados embaixo do escudo/nome daquele mesmo time.
  const drawTeamColumn = (cx: number, events: MatchStoryTeamEvents) => {
    ctx.textAlign = "center";
    let cy = y;
    if (events.goals.length === 0 && events.redCards.length === 0) {
      ctx.fillStyle = MUTED;
      ctx.font = "500 28px system-ui, sans-serif";
      ctx.fillText("—", cx, cy);
      return;
    }
    for (const goal of events.goals) {
      const minuteLabel = goal.minute !== null ? ` ${goal.minute}'` : "";
      ctx.fillStyle = FG;
      ctx.font = "500 30px system-ui, sans-serif";
      ctx.fillText(`⚽ ${goal.playerName}${minuteLabel}`, cx, cy, 420);
      cy += 50;
    }
    for (const card of events.redCards) {
      ctx.fillStyle = "oklch(0.68 0.21 25)";
      ctx.font = "500 30px system-ui, sans-serif";
      ctx.fillText(`🟥 ${card.playerName}`, cx, cy, 420);
      cy += 50;
    }
  };

  if (hasAnyEvent) {
    drawTeamColumn(homeX, params.homeEvents);
    drawTeamColumn(awayX, params.awayEvents);
  } else {
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.font = "500 30px system-ui, sans-serif";
    ctx.fillText("Nenhum gol na partida.", WIDTH / 2, y);
  }

  if (barHeight === 0) {
    ctx.textAlign = "center";
    ctx.fillStyle = MUTED;
    ctx.font = "600 28px system-ui, sans-serif";
    ctx.fillText("Interclássicos", WIDTH / 2, HEIGHT - 50);
  } else {
    await drawSponsorBar(ctx, sponsors);
  }

  return toBlob(canvas);
}

export type MvpStoryParams = {
  backgroundUrl?: string | null | undefined;
  photoUrl: string;
  playerName: string;
  teamName: string;
  teamLogoUrl: string | null;
  homeTeamName: string;
  awayTeamName: string;
  sponsors?: SponsorLogo[];
};

export async function generateMvpStoryImage(params: MvpStoryParams): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  await document.fonts.ready;

  const [background, teamLogo, photo] = await Promise.all([
    tryLoadImage(params.backgroundUrl),
    tryLoadImage(params.teamLogoUrl),
    loadImage(params.photoUrl),
  ]);

  drawBackground(ctx, background);

  const sponsors = params.sponsors ?? [];
  const barHeight = sponsorBarHeight(sponsors, "OFERECIMENTO");

  // O topo — 1/3 da altura do Stories — fica livre pro logo do fundo (nada nosso é desenhado
  // ali), e o título "Craque da partida" fica bem colado logo acima da foto do craque.
  const titleZoneH = HEIGHT / 3;
  const photoTop = titleZoneH + 20;
  const photoSize = 560;

  ctx.textAlign = "center";
  ctx.fillStyle = ACCENT;
  ctx.font = `700 44px ${DISPLAY_FONT}`;
  ctx.fillText("⭐ CRAQUE DA PARTIDA", WIDTH / 2, photoTop - 36);

  const photoX = (WIDTH - photoSize) / 2;
  ctx.save();
  ctx.shadowColor = "oklch(0 0 0 / 0.45)";
  ctx.shadowBlur = 45;
  drawCoverImage(ctx, photo, photoX, photoTop, photoSize, photoSize, 32);
  ctx.restore();
  ctx.strokeStyle = PRIMARY;
  ctx.lineWidth = 6;
  roundedRectPath(ctx, photoX, photoTop, photoSize, photoSize, 32);
  ctx.stroke();

  let cy = photoTop + photoSize + 70;
  const crestR = 44;
  drawCrestCircle(ctx, teamLogo, params.teamName, WIDTH / 2, cy + crestR, crestR);
  cy += crestR * 2 + 56;

  ctx.textAlign = "center";
  ctx.fillStyle = FG;
  ctx.font = `700 52px ${DISPLAY_FONT}`;
  ctx.fillText(params.playerName.toUpperCase(), WIDTH / 2, cy);
  cy += 44;

  ctx.fillStyle = MUTED;
  ctx.font = `600 30px ${DISPLAY_FONT}`;
  ctx.fillText(params.teamName, WIDTH / 2, cy);
  cy += 70;

  ctx.fillStyle = FG;
  ctx.font = `600 28px ${DISPLAY_FONT}`;
  const caption = `Vencedor do prêmio craque da partida jogo ${params.homeTeamName} vs ${params.awayTeamName}`;
  const contentBottom = HEIGHT - barHeight - 40;
  wrapText(ctx, caption, WIDTH / 2, Math.min(cy, contentBottom), WIDTH - 160, 36);

  await drawSponsorBar(ctx, sponsors, "OFERECIMENTO");

  return toBlob(canvas);
}
