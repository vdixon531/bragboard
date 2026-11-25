import type { Score } from './types';
import { addDays, weekStart } from './dates';

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
