// Game registry + share-text parsers.
// Shared by the web app (via the @shared alias) and the submit-score Edge Function (Deno),
// so keep this file dependency-free plain TypeScript.
//
// To add a game: add a GameDef to GAMES. `detect` should be cheap and specific;
// `parse` turns the pasted share text into a raw score; `points` maps that raw score
// to 0-100 (higher is always better) so different games can be summed in a league.

export type Motif =
  | 'topo' | 'bubbles' | 'crumbs' | 'flight' | 'tiles' | 'grid4'
  | 'threads' | 'clock' | 'globe' | 'film' | 'hourglass' | 'dots';

export interface GameTheme {
  bg: string;      // card background
  fg: string;      // text on bg
  accent: string;  // highlight on bg
  motif: Motif;
}

export interface Parsed {
  score: number;     // raw score in the game's own unit
  display: string;   // how the score reads, e.g. "3/6", "812", "0:42"
  failed?: boolean;
  puzzle?: string;   // puzzle number or date label from the share text
  meta?: Record<string, unknown>;
}

export interface ParseResult extends Parsed {
  gameId: string;
  points: number;    // normalised 0-100, higher = better
}

export interface GameDef {
  id: string;
  name: string;
  emoji: string;
  url: string;
  blurb: string;
  lowerIsBetter: boolean;
  /** false = share format not confirmed yet; parser is a best guess */
  verified: boolean;
  theme: GameTheme;
  manual: { label: string; min: number; max: number; step?: number; failLabel?: string };
  detect: (t: string) => boolean;
  parse: (t: string) => Parsed | null;
  points: (p: Parsed) => number;
  /** build a Parsed from a manually-entered number (failed = gave up / X) */
  fromManual: (value: number, failed?: boolean) => Parsed;
}

// ---------- helpers ----------
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const num = (s: string) => parseFloat(s.replace(/,/g, ''));
const round1 = (n: number) => Math.round(n * 10) / 10;
const GUESS_POINTS = [0, 100, 90, 75, 60, 40, 20]; // index = guesses, 7+/X = 0
const guessPoints = (g: number, failed?: boolean) => (failed || g > 6 ? 0 : GUESS_POINTS[g] ?? 0);
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Best-effort number extraction for games whose share format we haven't seen yet. */
function genericScore(t: string): Parsed | null {
  const ratio = t.match(/(\d[\d,]*(?:\.\d+)?)\s*\/\s*(\d[\d,]*)/);
  if (ratio) {
    const a = num(ratio[1]), b = num(ratio[2]);
    if (b > 0 && a <= b) return { score: a, display: `${ratio[1]}/${ratio[2]}`, meta: { max: b } };
  }
  const labelled = t.match(/(?:score|total|points?|pts)\s*[:=-]?\s*(\d[\d,]*(?:\.\d+)?)/i)
    ?? t.match(/(\d[\d,]*(?:\.\d+)?)\s*(?:points?|pts)\b/i);
  if (labelled) return { score: num(labelled[1]), display: labelled[1] };
  const pct = t.match(/(\d{1,3}(?:\.\d+)?)\s*%/);
  if (pct) return { score: num(pct[1]), display: `${pct[1]}%`, meta: { max: 100 } };
  return null;
}
const genericPoints = (p: Parsed) => {
  const max = typeof p.meta?.max === 'number' ? (p.meta.max as number) : 100;
  return clamp((p.score / max) * 100);
};

const guessGame = (
  id: string, name: string, emoji: string, url: string, blurb: string, theme: GameTheme,
  re: RegExp, detect: (t: string) => boolean,
): GameDef => ({
  id, name, emoji, url, blurb, theme, lowerIsBetter: true, verified: true,
  manual: { label: 'Guesses', min: 1, max: 6, failLabel: 'Didn’t get it (X)' },
  detect,
  parse: (t) => {
    const m = t.match(re);
    if (!m) return null;
    const failed = /x/i.test(m[2]);
    const g = failed ? 7 : parseInt(m[2], 10);
    return { score: g, display: `${failed ? 'X' : g}/6`, failed, puzzle: m[1]?.replace(/[,.]/g, ''), meta: { hard: Boolean(m[3]) } };
  },
  points: (p) => guessPoints(p.score, p.failed),
  fromManual: (v, failed) => ({ score: failed ? 7 : v, display: `${failed ? 'X' : v}/6`, failed }),
});

// ---------- the games ----------
export const GAMES: GameDef[] = [
  {
    id: 'maptap', name: 'MapTap', emoji: '📍', url: 'https://maptap.gg',
    blurb: 'Five taps on the map, scored out of 1000.',
    lowerIsBetter: false, verified: true,
    theme: { bg: '#0F6B5C', fg: '#F2FFF9', accent: '#FFD166', motif: 'topo' },
    manual: { label: 'Final score', min: 0, max: 1000 },
    detect: (t) => /maptap/i.test(t),
    parse: (t) => {
      const fin = t.match(/final\s*score\s*:?\s*(\d[\d,]*)/i);
      if (!fin) return null;
      const date = t.match(/maptap(?:\.gg)?\s+([A-Za-z]+\s+\d{1,2})/i)?.[1];
      const rounds: number[] = [];
      for (const line of t.split(/\r?\n/)) {
        if (/final\s*score|maptap/i.test(line)) continue;
        for (const m of line.matchAll(/(\d{1,3})\s*\p{Extended_Pictographic}/gu)) rounds.push(parseInt(m[1], 10));
      }
      const score = num(fin[1]);
      return { score, display: String(score), puzzle: date, meta: rounds.length ? { rounds } : undefined };
    },
    points: (p) => clamp(p.score / 10),
    fromManual: (v) => ({ score: v, display: String(v) }),
  },
  {
    id: 'krillion', name: 'Krillion', emoji: '🦐', url: 'https://krillion.io',
    blurb: 'Seven prompts. Rarer answers dive deeper.',
    lowerIsBetter: false, verified: false,
    theme: { bg: '#0A2340', fg: '#E6F6FF', accent: '#FF7A9C', motif: 'bubbles' },
    manual: { label: 'Points (0–700)', min: 0, max: 700 },
    detect: (t) => /krillion/i.test(t),
    parse: (t) => {
      // Format not confirmed yet. Accept "430 pts" / "Score: 430" / "4,300m" (1 pt = 10 m).
      const pts = t.match(/(\d[\d,]*)\s*(?:pts|points)\b/i) ?? t.match(/(?:score|total)\s*:?\s*(\d[\d,]*)/i);
      let points: number | null = pts ? num(pts[1]) : null;
      if (points == null) {
        const depth = t.match(/(\d[\d,]*)\s*(?:m|meters|metres)\b/i);
        if (depth) points = Math.round(num(depth[1]) / 10);
      }
      if (points == null) return null;
      const puzzle = t.match(/#\s*(\d+)/)?.[1];
      return { score: points, display: `${points} pts`, puzzle, meta: { depth: points * 10 } };
    },
    points: (p) => clamp(p.score / 7),
    fromManual: (v) => ({ score: v, display: `${v} pts`, meta: { depth: v * 10 } }),
  },
  {
    id: 'yeastimate', name: 'Yeastimate', emoji: '🍞', url: 'https://www.google.com/search?q=yeastimate+game',
    blurb: 'Estimate it. Watch the dough rise.',
    lowerIsBetter: false, verified: false,
    theme: { bg: '#E9B872', fg: '#3B2412', accent: '#8C3B12', motif: 'crumbs' },
    manual: { label: 'Score (0–100)', min: 0, max: 100 },
    detect: (t) => /yeastimate/i.test(t),
    parse: (t) => genericScore(t.replace(/yeastimate\s*#?\s*\d*/i, '')),
    points: genericPoints,
    fromManual: (v) => ({ score: v, display: String(v) }),
  },
  {
    id: 'plane', name: 'Plane', emoji: '✈️', url: 'https://www.google.com/search?q=plane+daily+game',
    blurb: 'Name the aircraft. Clear for takeoff.',
    lowerIsBetter: false, verified: false,
    theme: { bg: '#2F7FE8', fg: '#F5FAFF', accent: '#FFFFFF', motif: 'flight' },
    manual: { label: 'Score (0–100)', min: 0, max: 100 },
    detect: (t) => /\bplane\b|✈/i.test(t),
    parse: (t) => genericScore(t.replace(/plane\w*\s*#?\s*\d*/i, '')),
    points: genericPoints,
    fromManual: (v) => ({ score: v, display: String(v) }),
  },
  guessGame('wordle', 'Wordle', '🟩', 'https://www.nytimes.com/games/wordle',
    'Six tries, five letters.',
    { bg: '#538D4E', fg: '#FFFFFF', accent: '#C9B458', motif: 'tiles' },
    /wordle\s+#?\s*([\d.,]+)\s+([1-6xX])\/6(\*)?/i, (t) => /\bwordle\s+#?\s*[\d.,]+\s+[1-6xX]\/6/i.test(t)),
  {
    id: 'connections', name: 'Connections', emoji: '🟪', url: 'https://www.nytimes.com/games/connections',
    blurb: 'Sixteen words, four groups.',
    lowerIsBetter: true, verified: true,
    theme: { bg: '#B784C9', fg: '#1E1330', accent: '#F9DF6D', motif: 'grid4' },
    manual: { label: 'Mistakes', min: 0, max: 3, failLabel: 'Didn’t solve it' },
    detect: (t) => /connections/i.test(t) && /[🟨🟩🟦🟪]/u.test(t),
    parse: (t) => {
      const rows = t.split(/\r?\n/)
        .map((l) => [...l.matchAll(/🟨|🟩|🟦|🟪/gu)].map((m) => m[0]))
        .filter((r) => r.length === 4);
      if (!rows.length) return null;
      const solved = rows.filter((r) => r.every((c) => c === r[0]));
      const mistakes = rows.length - solved.length;
      const failed = solved.length < 4;
      const purpleFirst = rows[0].every((c) => c === '🟪');
      const puzzle = t.match(/puzzle\s*#\s*([\d,]+)/i)?.[1]?.replace(/,/g, '');
      return {
        score: failed ? 4 : mistakes,
        display: failed ? `${solved.length}/4 groups` : mistakes === 0 ? 'Perfect' : plural(mistakes, 'mistake'),
        failed, puzzle, meta: { solved: solved.length, purpleFirst },
      };
    },
    points: (p) => (p.failed ? ((p.meta?.solved as number) ?? 0) * 8 : [100, 80, 60, 40][p.score] ?? 40),
    fromManual: (v, failed) => ({
      score: failed ? 4 : v, failed,
      display: failed ? 'Unsolved' : v === 0 ? 'Perfect' : plural(v, 'mistake'), meta: { solved: failed ? 0 : 4 },
    }),
  },
  {
    id: 'strands', name: 'Strands', emoji: '🧵', url: 'https://www.nytimes.com/games/strands',
    blurb: 'Find the theme words and the spangram.',
    lowerIsBetter: true, verified: true,
    theme: { bg: '#AEDCEC', fg: '#0E2E44', accent: '#F4C400', motif: 'threads' },
    manual: { label: 'Hints used', min: 0, max: 10 },
    detect: (t) => /strands\s*#\s*\d+/i.test(t),
    parse: (t) => {
      const puzzle = t.match(/strands\s*#\s*([\d,]+)/i)?.[1]?.replace(/,/g, '');
      const hints = [...t.matchAll(/💡/gu)].length;
      const theme = t.match(/[“"]([^”"]+)[”"]/)?.[1];
      return { score: hints, display: hints === 0 ? 'No hints' : plural(hints, 'hint'), puzzle, meta: { theme } };
    },
    points: (p) => clamp(100 - p.score * 15),
    fromManual: (v) => ({ score: v, display: v === 0 ? 'No hints' : plural(v, 'hint') }),
  },
  {
    id: 'mini', name: 'The Mini', emoji: '⏱️', url: 'https://www.nytimes.com/crosswords/game/mini',
    blurb: 'Five-by-five crossword against the clock.',
    lowerIsBetter: true, verified: true,
    theme: { bg: '#4A7FE0', fg: '#FFFFFF', accent: '#FFDA3A', motif: 'clock' },
    manual: { label: 'Time in seconds', min: 1, max: 3600 },
    detect: (t) => /mini\s*crossword/i.test(t) || /nytimes\.com\/(?:badges\/games\/)?mini/i.test(t),
    parse: (t) => {
      const m = t.match(/(?:in|time:?)\s*(?:(\d+):)?(\d{1,2}):(\d{2})/i) ?? t.match(/()(\d+):(\d{2})/);
      if (!m) return null;
      const s = (m[1] ? parseInt(m[1], 10) * 3600 : 0) + parseInt(m[2], 10) * 60 + parseInt(m[3], 10);
      return { score: s, display: mmss(s) };
    },
    points: (p) => clamp(100 - ((p.score - 20) * 100) / 280, 5, 100),
    fromManual: (v) => ({ score: v, display: mmss(v) }),
  },
  guessGame('worldle', 'Worldle', '🗺️', 'https://worldle.teuteuf.fr',
    'Guess the country from its outline.',
    { bg: '#1F2A44', fg: '#F2F5FF', accent: '#3BB273', motif: 'globe' },
    /#?worldle\s+#?\s*([\d,]+)[^\n]*?\s([1-6xX])\/6/i, (t) => /#?worldle\s+#?\s*\d/i.test(t)),
  {
    id: 'globle', name: 'Globle', emoji: '🌍', url: 'https://globle-game.com',
    blurb: 'Hot and cold, country by country.',
    lowerIsBetter: true, verified: true,
    theme: { bg: '#C8461B', fg: '#FFF6EC', accent: '#FFE066', motif: 'globe' },
    manual: { label: 'Guesses', min: 1, max: 60 },
    detect: (t) => /globle/i.test(t),
    parse: (t) => {
      const m = t.match(/=\s*(\d+)/) ?? t.match(/(\d+)\s*guess/i);
      if (!m) return null;
      const g = parseInt(m[1], 10);
      return { score: g, display: `${g} ${g === 1 ? 'guess' : 'guesses'}` };
    },
    points: (p) => clamp(100 - (p.score - 1) * 8, 5, 100),
    fromManual: (v) => ({ score: v, display: `${v} ${v === 1 ? 'guess' : 'guesses'}` }),
  },
  {
    id: 'timeguessr', name: 'TimeGuessr', emoji: '⏳', url: 'https://timeguessr.com',
    blurb: 'Where and when was this photo taken?',
    lowerIsBetter: false, verified: true,
    theme: { bg: '#3D2C1E', fg: '#F6E7CF', accent: '#E3A857', motif: 'hourglass' },
    manual: { label: 'Score (0–50,000)', min: 0, max: 50000 },
    detect: (t) => /timeguessr/i.test(t),
    parse: (t) => {
      const m = t.match(/timeguessr\s*#?\s*(\d+)\s+([\d,]+)\s*\/\s*50,?000/i) ?? t.match(/()([\d,]+)\s*\/\s*50,?000/);
      if (!m) return null;
      const s = num(m[2]);
      return { score: s, display: s.toLocaleString('en-US'), puzzle: m[1] || undefined };
    },
    points: (p) => clamp(p.score / 500),
    fromManual: (v) => ({ score: v, display: v.toLocaleString('en-US') }),
  },
  {
    id: 'framed', name: 'Framed', emoji: '🎬', url: 'https://framed.wtf',
    blurb: 'Name the movie, one frame at a time.',
    lowerIsBetter: true, verified: true,
    theme: { bg: '#15151A', fg: '#F7F7F7', accent: '#E63946', motif: 'film' },
    manual: { label: 'Frames needed', min: 1, max: 6, failLabel: 'Didn’t get it' },
    detect: (t) => /framed\s*#\s*\d+/i.test(t),
    parse: (t) => {
      const puzzle = t.match(/framed\s*#\s*(\d+)/i)?.[1];
      const line = t.split(/\r?\n/).find((l) => /🎥/u.test(l)) ?? t;
      const squares = [...line.matchAll(/🟥|🟩|⬛|⬜/gu)].map((m) => m[0]);
      if (!squares.length) return null;
      const idx = squares.indexOf('🟩');
      const failed = idx < 0;
      const g = failed ? 7 : idx + 1;
      return { score: g, display: failed ? 'X/6' : `${g}/6`, failed, puzzle };
    },
    points: (p) => guessPoints(p.score, p.failed),
    fromManual: (v, failed) => ({ score: failed ? 7 : v, display: `${failed ? 'X' : v}/6`, failed }),
  },
];

// Specific formats are checked before the loose best-guess ones (Plane/Yeastimate/Krillion match on a word).
const LOOSE = new Set(['plane', 'yeastimate', 'krillion']);
const PARSE_ORDER = [...GAMES.filter((g) => !LOOSE.has(g.id)), ...GAMES.filter((g) => LOOSE.has(g.id))];

export const GAME_MAP: Record<string, GameDef> = Object.fromEntries(GAMES.map((g) => [g.id, g]));
export const getGame = (id: string): GameDef | undefined => GAME_MAP[id];

function finish(def: GameDef, p: Parsed): ParseResult {
  return { ...p, gameId: def.id, points: round1(def.points(p)) };
}

/** Parse pasted share text. Returns null if no game recognised it. */
export function parseShare(text: string, onlyGames?: string[]): ParseResult | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  for (const def of PARSE_ORDER) {
    if (onlyGames && !onlyGames.includes(def.id)) continue;
    if (!def.detect(t)) continue;
    const p = def.parse(t);
    if (p && Number.isFinite(p.score)) return finish(def, p);
  }
  return null;
}

/** Score entered by hand (for unconfirmed formats or when parsing fails). */
export function manualScore(gameId: string, value: number, failed = false): ParseResult | null {
  const def = GAME_MAP[gameId];
  if (!def || !Number.isFinite(value)) return null;
  const v = clamp(value, def.manual.min, def.manual.max);
  return finish(def, { ...def.fromManual(v, failed), meta: { ...(def.fromManual(v, failed).meta ?? {}), manual: true } });
}
