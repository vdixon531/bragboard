import type { Score } from './types';

export interface Ranked { score: Score; rank: number }

/** Rank one game on one day. Points are already "higher is better" for every game. Ties share a rank. */
export function rankBoard(scores: Score[]): Ranked[] {
  const sorted = [...scores].sort((a, b) => b.points - a.points || a.created_at.localeCompare(b.created_at));
  const out: Ranked[] = [];
  sorted.forEach((s, i) => {
    const rank = i > 0 && s.points === sorted[i - 1].points ? out[i - 1].rank : i + 1;
    out.push({ score: s, rank });
  });
  return out;
}

/** gameId -> ranked board for one day */
export function dayBoards(scores: Score[], games: string[], day: string): Record<string, Ranked[]> {
  const out: Record<string, Ranked[]> = {};
  for (const g of games) out[g] = rankBoard(scores.filter((s) => s.day === day && s.game_id === g));
  return out;
}

export interface Standing {
  userId: string;
  total: number;
  played: number;
  wins: number;
  podiums: number;
  avg: number;
  rank: number;
}

/** Totals over a date range. A win = 1st place in a game-day that at least two people played. */
export function standings(scores: Score[], memberIds: string[], games: string[], from: string, to: string): Standing[] {
  const inRange = scores.filter((s) => s.day >= from && s.day <= to && games.includes(s.game_id));
  const map = new Map<string, Standing>(
    memberIds.map((id) => [id, { userId: id, total: 0, played: 0, wins: 0, podiums: 0, avg: 0, rank: 0 }]),
  );

  const groups = new Map<string, Score[]>();
  for (const s of inRange) {
    const k = `${s.day}|${s.game_id}`;
    groups.set(k, [...(groups.get(k) ?? []), s]);
  }
  for (const group of groups.values()) {
    const board = rankBoard(group);
    for (const { score, rank } of board) {
      const st = map.get(score.user_id);
      if (!st) continue;
      st.total += score.points;
      st.played += 1;
      if (board.length >= 2 && rank === 1) st.wins += 1;
      if (board.length >= 2 && rank <= 3) st.podiums += 1;
    }
  }
  const list = [...map.values()].map((s) => ({ ...s, total: Math.round(s.total), avg: s.played ? Math.round(s.total / s.played) : 0 }));
  list.sort((a, b) => b.total - a.total || b.wins - a.wins || b.avg - a.avg);
  list.forEach((s, i) => {
    s.rank = i > 0 && s.total === list[i - 1].total && s.wins === list[i - 1].wins ? list[i - 1].rank : i + 1;
  });
  return list;
}

/** Consecutive days (ending today or yesterday) with at least one posted score. */
export function currentStreak(days: Set<string>, todayStr: string, addDays: (s: string, n: number) => string): number {
  let d = days.has(todayStr) ? todayStr : addDays(todayStr, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
