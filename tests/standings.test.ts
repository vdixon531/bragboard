import { describe, expect, it } from 'vitest';
import { rankBoard, standings } from '../src/lib/standings';
import { leagueAwards } from '../src/lib/awards';
import type { Score } from '../src/lib/types';

let id = 0;
const s = (user: string, game: string, day: string, points: number, extra: Partial<Score> = {}): Score => ({
  id: ++id, user_id: user, game_id: game, day, score: points, points, display: String(points),
  failed: false, puzzle: null, meta: {}, source: 'app', created_at: `${day}T12:00:0${id % 10}Z`, ...extra,
});

describe('rankBoard', () => {
  it('shares ranks on ties', () => {
    const b = rankBoard([s('a', 'wordle', '2026-11-18', 75), s('b', 'wordle', '2026-11-18', 90), s('c', 'wordle', '2026-11-18', 75)]);
    expect(b.map((r) => [r.score.user_id, r.rank])).toEqual([['b', 1], ['a', 2], ['c', 2]]);
  });
});

describe('standings', () => {
  it('sums points and counts contested wins only', () => {
    const scores = [
      s('a', 'maptap', '2026-11-18', 80), s('b', 'maptap', '2026-11-18', 60),
      s('a', 'wordle', '2026-11-18', 40), s('b', 'wordle', '2026-11-18', 90),
      s('a', 'krillion', '2026-11-18', 50), // solo game: no win credited
    ];
    const t = standings(scores, ['a', 'b', 'c'], ['maptap', 'wordle', 'krillion'], '2026-11-18', '2026-11-18');
    expect(t[0]).toMatchObject({ userId: 'a', total: 170, wins: 1, played: 3, rank: 1 });
    expect(t[1]).toMatchObject({ userId: 'b', total: 150, wins: 1, rank: 2 });
    expect(t[2]).toMatchObject({ userId: 'c', total: 0, played: 0 });
  });
});

describe('leagueAwards', () => {
  it('gives crown, sweep, early bird and a 3-day streak', () => {
    const scores = [
      s('a', 'maptap', '2026-11-16', 50), s('a', 'maptap', '2026-11-17', 50),
      s('a', 'maptap', '2026-11-18', 95, { score: 950, created_at: '2026-11-18T08:00:00' }),
      s('b', 'maptap', '2026-11-18', 70, { created_at: '2026-11-18T09:00:00' }),
      s('a', 'wordle', '2026-11-18', 100, { score: 1, created_at: '2026-11-18T08:05:00' }),
      s('b', 'wordle', '2026-11-18', 60, { created_at: '2026-11-18T09:05:00' }),
    ];
    const keys = leagueAwards(scores, ['a', 'b'], ['maptap', 'wordle'], '2026-11-18')
      .filter((x) => x.day === '2026-11-18' && x.userId === 'a').map((x) => x.key).sort();
    expect(keys).toEqual(['ace', 'atlas', 'crown', 'early', 'streak3', 'sweep']);
  });
});
