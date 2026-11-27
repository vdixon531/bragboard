import type { Score } from './types';
import { addDays, weekStart } from './dates';
import { standings } from './standings';

export type Bucket = 'day' | 'week';

export interface RaceLine { userId: string; values: number[] }
export interface Race { xs: string[]; bucket: Bucket; lines: RaceLine[] }

/**
 * Running points totals per player, for the line graph.
 * x points run from `from` to `to` (inclusive), one per day or one per week (keyed by the week's Monday).
 * Players with no scores in the range are left off.
 */
export function pointsRace(scores: Score[], memberIds: string[], games: string[], from: string, to: string, bucket: Bucket): Race {
  const members = new Set(memberIds);
  const inRange = scores.filter((s) => s.day >= from && s.day <= to && games.includes(s.game_id) && members.has(s.user_id));

  const key = (day: string) => (bucket === 'week' ? weekStart(day) : day);
  const xs: string[] = [];
  const step = bucket === 'week' ? 7 : 1;
  for (let d = key(from); d <= to; d = addDays(d, step)) xs.push(d);
  const index = new Map(xs.map((x, i) => [x, i]));

  const perBucket = new Map<string, number[]>();
  for (const s of inRange) {
    const i = index.get(key(s.day));
    if (i === undefined) continue;
    let arr = perBucket.get(s.user_id);
    if (!arr) { arr = new Array(xs.length).fill(0); perBucket.set(s.user_id, arr); }
    arr[i] += s.points;
  }

  const lines: RaceLine[] = memberIds.filter((id) => perBucket.has(id)).map((userId) => {
    let run = 0;
    return { userId, values: perBucket.get(userId)!.map((v) => Math.round((run += v))) };
  });
  return { xs, bucket, lines };
}

/** First day any member scored in these games, or null. Used as the start of the all-time graph. */
export function firstScoreDay(scores: Score[], memberIds: string[], games: string[]): string | null {
  const members = new Set(memberIds);
  let first: string | null = null;
  for (const s of scores) {
    if (!members.has(s.user_id) || !games.includes(s.game_id)) continue;
    if (first === null || s.day < first) first = s.day;
  }
  return first;
}

export interface RankLine {
  userId: string;
  /** 1-based position in the running standings at the end of each day; null before their first score. */
  ranks: (number | null)[];
  /** Running points total at the end of each day (null where `ranks` is null). */
  totals: (number | null)[];
}
export interface RankRace { xs: string[]; places: number; lines: RankLine[] }

/**
 * Position in the period's standings at the end of each day, for the bump chart.
 * x points run every day from `from` to `to` (pass today as `to`, so the axis ends now). Positions use the standings table's order (points, then wins, then average), so the line
 * on the last day matches the table below. Players join the chart on the day they first score.
 */
export function rankRace(scores: Score[], memberIds: string[], games: string[], from: string, to: string): RankRace {
  const xs: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) xs.push(d);

  const lines = new Map<string, RankLine>(memberIds.map((id) => [id, {
    userId: id, ranks: new Array(xs.length).fill(null), totals: new Array(xs.length).fill(null),
  }]));
  let places = 0;
  for (let i = 0; i < xs.length; i++) {
    const table = standings(scores, memberIds, games, from, xs[i]).filter((s) => s.played > 0);
    places = Math.max(places, table.length);
    table.forEach((s, k) => {
      const l = lines.get(s.userId)!;
      l.ranks[i] = k + 1;
      l.totals[i] = s.total;
    });
  }
  return { xs, places, lines: [...lines.values()].filter((l) => l.ranks.some((r) => r !== null)) };
}
