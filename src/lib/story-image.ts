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
/** Fundo padrão das artes, servido pelo próprio app. A edição pode cadastrar o dela em Edição →
 * Imagem de fundo; sem isso, é este que entra, em vez do gradiente liso de antes. */
const DEFAULT_BACKGROUND_URL = "/story-bg.jpg";

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
    veil.addColorStop(0, "oklch(0.08 0.03 265 / 0.55)");
    veil.addColorStop(0.42, "oklch(0.08 0.03 265 / 0.25)");
    // A base fecha bem mais escura porque é onde ficam as logos brancas dos patrocinadores, e
    // no fundo padrão essa faixa cai justo no gramado claro.
    veil.addColorStop(0.78, "oklch(0.06 0.03 265 / 0.78)");
    veil.addColorStop(1, "oklch(0.04 0.03 265 / 0.94)");
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

/** Desenha texto centralizado com espaçamento entre letras (o `letterSpacing` do canvas ainda
 * não é universal). Devolve a largura total ocupada. */
function fillTextTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  tracking: number,
): number {
  const chars = [...text];
  const total =
    chars.reduce((a, c) => a + ctx.measureText(c).width, 0) + tracking * (chars.length - 1);
  const prevAlign = ctx.textAlign;
  ctx.textAlign = "left";
  let x = cx - total / 2;
  for (const c of chars) {
    ctx.fillText(c, x, y);
    x += ctx.measureText(c).width + tracking;
  }
  ctx.textAlign = prevAlign;
  return total;
}

/** Diminui o corpo da fonte até o texto caber em `maxWidth` e deixa `ctx.font` já ajustado.
 * Nome de jogador é digitado por gente, então não dá pra confiar num tamanho fixo. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  weight: number,
  family: string,
): number {
  let size = maxSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (size > minSize && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
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

/** Alturas máximas de cada linha. São tetos, não alturas fixas: o dimensionamento por área
 * (ver `rowScale`) só encolhe a partir daqui, então dá pra reservar o espaço no layout antes
 * de as logos terem carregado. */
const SPONSOR_MASTER_H = 104;
const SPONSOR_OTHER_H = 84;
/** O master ocupa mais área que os demais, como no banner de lona (ver camiseta/banner.py). */
const SPONSOR_MASTER_WEIGHT = 1.35;
const SPONSOR_MAX_PER_ROW = 5;
const SPONSOR_LOGO_GAP = 36;
const SPONSOR_ROW_GAP = 30;
const SPONSOR_LABEL_BLOCK = 42;
const SPONSOR_SIDE = 76;
const SPONSOR_BOTTOM_MARGIN = 64;
const SPONSOR_TOP_AIR = 24;

type SponsorRow = { items: SponsorLogo[]; maxHeight: number; isMaster: boolean };

/** Distribui os patrocinadores em linhas: o master sozinho na primeira (é o que dá nome ao
 * torneio, então não disputa espaço com ninguém) e os demais em linhas de até cinco. As logos
 * brancas vêm recortadas, sem caixa em volta, então cinco numa linha ainda leem bem. */
function planSponsorRows(sponsors: SponsorLogo[]): SponsorRow[] {
  if (sponsors.length === 0) return [];
  const master = sponsors.find((s) => s.isMaster) ?? null;
  const others = sponsors.filter((s) => s !== master);
  const rows: SponsorRow[] = [];
  if (master) rows.push({ items: [master], maxHeight: SPONSOR_MASTER_H, isMaster: true });

  const rowCount = Math.max(1, Math.ceil(others.length / SPONSOR_MAX_PER_ROW));
  let start = 0;
  for (let i = 0; i < rowCount && start < others.length; i++) {
    // reparte o que sobrou pelas linhas que faltam, pra não terminar com uma linha órfã
    const size = Math.ceil((others.length - start) / (rowCount - i));
    rows.push({
      items: others.slice(start, start + size),
      maxHeight: SPONSOR_OTHER_H,
      isMaster: false,
    });
    start += size;
  }
  return rows;
}

/** Altura reservada pro bloco de patrocinadores, calculada a partir das linhas planejadas sem
 * depender das logos terem carregado, pra o conteúdo acima já saber onde termina. */
function sponsorBarHeight(sponsors: SponsorLogo[], label?: string): number {
  const rows = planSponsorRows(sponsors);
  if (rows.length === 0) return 0;
  const rowsH = rows.reduce((a, r) => a + r.maxHeight, 0) + SPONSOR_ROW_GAP * (rows.length - 1);
  return Math.round(
    SPONSOR_TOP_AIR + (label ? SPONSOR_LABEL_BLOCK : 0) + rowsH + SPONSOR_BOTTOM_MARGIN,
  );
}

/**
 * Fator de escala que faz a fila caber, igualando ÁREA e não altura (mesma conta do banner de
 * lona em camiseta/banner.py). Numa fila com uma logo quase quadrada ao lado de uma quase faixa,
 * altura igual faz a faixa sumir e o quadrado dominar; igualando a raiz da área as duas pesam o
 * mesmo no olho. O fator sai separado do desenho porque todas as linhas de não-master usam um
 * fator único (o menor entre elas), senão a linha com menos marcas sairia com logos maiores que
 * a linha cheia logo acima.
 */
function rowScale(
  imgs: HTMLImageElement[],
  weights: number[],
  maxWidth: number,
  maxHeight: number,
  gap: number,
): number {
  const ratios = imgs.map((img) => img.width / img.height);
  const sum = ratios.reduce((a, r, i) => a + weights[i]! * Math.sqrt(r), 0);
  const byWidth = (maxWidth - gap * (imgs.length - 1)) / sum;
  // A logo mais quadrada da linha é a primeira a encostar no teto de altura, e é ela que
  // define até onde o fator pode subir sem que ninguém estoure a faixa.
  const byHeight = Math.min(...ratios.map((r, i) => (maxHeight * Math.sqrt(r)) / weights[i]!));
  return Math.min(byWidth, byHeight);
}

/** O teto por logo é rede de segurança: `rowScale` já devolve um fator em que ninguém estoura
 * a faixa, mas o corte aqui garante isso mesmo se a conta mudar. */
function sizesFromScale(imgs: HTMLImageElement[], weights: number[], k: number, maxHeight: number) {
  return imgs.map((img, i) => {
    const ratio = img.width / img.height;
    let w = k * weights[i]! * Math.sqrt(ratio);
    let h = w / ratio;
    if (h > maxHeight) {
      h = maxHeight;
      w = h * ratio;
    }
    return { w, h };
  });
}

/**
 * Logos dos patrocinadores na base do Stories, direto sobre o fundo — sem faixa branca por
 * trás. As logos cadastradas são as versões brancas (as mesmas do banner de lona), então o que
 * garante a leitura é o véu escuro que `drawBackground` já deixa mais forte embaixo. O master
 * abre sozinho, maior que os demais.
 */
async function drawSponsorBar(
  ctx: CanvasRenderingContext2D,
  sponsors: SponsorLogo[],
  label?: string,
) {
  const barHeight = sponsorBarHeight(sponsors, label);
  if (barHeight === 0) return;

  let y = HEIGHT - barHeight + SPONSOR_TOP_AIR;
  if (label) {
    ctx.textAlign = "center";
    ctx.fillStyle = "oklch(1 0 0 / 0.55)";
    ctx.font = `600 22px ${DISPLAY_FONT}`;
    fillTextTracked(ctx, label.toUpperCase(), WIDTH / 2, y + 20, 10);
    y += SPONSOR_LABEL_BLOCK;
  }

  const planned = planSponsorRows(sponsors);
  const loadedRows = (
    await Promise.all(
      planned.map(async (row) => ({
        ...row,
        items: (
          await Promise.all(
            row.items.map(async (s) => ({
              img: await tryLoadImage(s.logoUrl),
              isMaster: s.isMaster,
            })),
          )
        ).filter((s): s is { img: HTMLImageElement; isMaster: boolean } => s.img !== null),
      })),
    )
  ).filter((row) => row.items.length > 0);

  const rowMaxWidth = WIDTH - SPONSOR_SIDE * 2;
  const weightsOf = (row: (typeof loadedRows)[number]) =>
    row.items.map((s) => (s.isMaster ? SPONSOR_MASTER_WEIGHT : 1));

  // Um fator único pras linhas de não-master: assim as marcas têm todas o mesmo peso no olho,
  // e a linha com menos marcas fica só mais estreita, centralizada, em vez de maior.
  const otherRows = loadedRows.filter((row) => !row.isMaster);
  const otherScale = otherRows.length
    ? Math.min(
        ...otherRows.map((row) =>
          rowScale(
            row.items.map((s) => s.img),
            weightsOf(row),
            rowMaxWidth,
            SPONSOR_OTHER_H,
            SPONSOR_LOGO_GAP,
          ),
        ),
      )
    : 0;

  for (const row of loadedRows) {
    const imgs = row.items.map((s) => s.img);
    const weights = weightsOf(row);
    const k = row.isMaster
      ? rowScale(imgs, weights, rowMaxWidth, SPONSOR_MASTER_H, SPONSOR_LOGO_GAP)
      : otherScale;
    const sizes = sizesFromScale(imgs, weights, k, row.maxHeight);
    const total = sizes.reduce((a, s) => a + s.w, 0) + SPONSOR_LOGO_GAP * (sizes.length - 1);
    let cx = WIDTH / 2 - total / 2;
    const rowCenterY = y + row.maxHeight / 2;
    sizes.forEach((size, i) => {
      drawContainImage(ctx, imgs[i]!, cx + size.w / 2, rowCenterY, size.w, size.h);
      cx += size.w + SPONSOR_LOGO_GAP;
    });
    y += row.maxHeight + SPONSOR_ROW_GAP;
  }
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
    tryLoadImage(params.backgroundUrl ?? DEFAULT_BACKGROUND_URL),
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
  const panelTop = Math.max(
    40,
    Math.min(Math.max(140, (HEIGHT - panelH) / 2), availableH - panelH - 20),
  );
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
    ctx.fillText("Interclássicos DuoVolts", WIDTH / 2, HEIGHT - 50);
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

const MVP_PHOTO_W = 780;
const MVP_PHOTO_TOP = 424;

/**
 * Arte "craque da partida": título, retrato do jogador e, na base, as logos dos patrocinadores
 * direto sobre o fundo. Sem placas, molduras coloridas ou pílulas — o fundo do estádio já é
 * carregado, e tudo que se soma a ele disputa atenção com a foto do craque, que é o assunto.
 * Só depende da foto importada: o resto vem do cadastro, então mandar a foto fecha a peça.
 */
export async function generateMvpStoryImage(params: MvpStoryParams): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  await document.fonts.ready;

  const [background, teamLogo, photo] = await Promise.all([
    tryLoadImage(params.backgroundUrl ?? DEFAULT_BACKGROUND_URL),
    tryLoadImage(params.teamLogoUrl),
    loadImage(params.photoUrl),
  ]);

  drawBackground(ctx, background);

  const sponsors = params.sponsors ?? [];
  const contentBottom = HEIGHT - sponsorBarHeight(sponsors, "OFERECIMENTO");

  ctx.textAlign = "center";
  ctx.fillStyle = ACCENT;
  ctx.font = `600 26px ${DISPLAY_FONT}`;
  fillTextTracked(ctx, "INTERCLÁSSICOS DUOVOLTS", WIDTH / 2, 252, 10);

  ctx.fillStyle = FG;
  ctx.font = `700 72px ${DISPLAY_FONT}`;
  fillTextTracked(ctx, "CRAQUE DA PARTIDA", WIDTH / 2, 340, 8);

  // O retrato ocupa a folga entre o título e o bloco de nome, então a arte se reajusta sozinha
  // quando o bloco de patrocinadores cresce (mais marcas = mais linhas).
  const nameBlockH = 240;
  const photoH = Math.max(700, Math.min(980, contentBottom - nameBlockH - MVP_PHOTO_TOP));
  const photoX = (WIDTH - MVP_PHOTO_W) / 2;

  ctx.save();
  ctx.shadowColor = "oklch(0 0 0 / 0.5)";
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 16;
  roundedRectPath(ctx, photoX, MVP_PHOTO_TOP, MVP_PHOTO_W, photoH, 24);
  ctx.fillStyle = "oklch(0.12 0.03 265)";
  ctx.fill();
  ctx.restore();

  // Ancorado acima do centro: em foto de pessoa o rosto fica no terço de cima, e é ele que não
  // pode ser cortado pelo enquadramento.
  drawCoverImage(ctx, photo, photoX, MVP_PHOTO_TOP, MVP_PHOTO_W, photoH, 24, 0.5, 0.28);

  ctx.strokeStyle = "oklch(1 0 0 / 0.22)";
  ctx.lineWidth = 2;
  roundedRectPath(ctx, photoX, MVP_PHOTO_TOP, MVP_PHOTO_W, photoH, 24);
  ctx.stroke();

  const photoBottom = MVP_PHOTO_TOP + photoH;

  ctx.textAlign = "center";
  ctx.fillStyle = FG;
  const name = params.playerName.toUpperCase();
  fitFont(ctx, name, WIDTH - 140, 76, 40, 700, DISPLAY_FONT);
  ctx.fillText(name, WIDTH / 2, photoBottom + 96);

  // Escudo e nome do time numa linha só, centralizada como um conjunto.
  const crestR = 24;
  const teamBaseline = photoBottom + 150;
  ctx.font = `600 30px ${DISPLAY_FONT}`;
  const teamTextW = ctx.measureText(params.teamName).width;
  const gap = 14;
  const blockW = crestR * 2 + gap + teamTextW;
  const blockLeft = WIDTH / 2 - blockW / 2;
  drawCrestCircle(ctx, teamLogo, params.teamName, blockLeft + crestR, teamBaseline - 10, crestR);
  ctx.textAlign = "left";
  ctx.fillStyle = MUTED;
  ctx.fillText(params.teamName, blockLeft + crestR * 2 + gap, teamBaseline);

  ctx.textAlign = "center";
  ctx.fillStyle = "oklch(1 0 0 / 0.55)";
  ctx.font = `600 26px ${DISPLAY_FONT}`;
  fillTextTracked(
    ctx,
    `${params.homeTeamName.toUpperCase()}  ×  ${params.awayTeamName.toUpperCase()}`,
    WIDTH / 2,
    photoBottom + 210,
    5,
  );

  await drawSponsorBar(ctx, sponsors, "OFERECIMENTO");

  return toBlob(canvas);
}
