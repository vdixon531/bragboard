import { describe, expect, it } from 'vitest';
import { firstScoreDay, pointsRace } from '../src/lib/series';
import type { Score } from '../src/lib/types';

let id = 0;
const s = (user: string, game: string, day: string, points: number): Score => ({
  id: ++id, user_id: user, game_id: game, day, score: points, points, display: String(points),
  failed: false, puzzle: null, meta: {}, source: 'app', created_at: `${day}T12:00:00Z`,
});

describe('pointsRace', () => {
  const games = ['wordle', 'maptap'];

  it('builds daily running totals up to the end day and drops players with no scores', () => {
    const scores = [
      s('a', 'wordle', '2026-11-16', 90), s('a', 'maptap', '2026-11-16', 10),
      s('b', 'wordle', '2026-11-17', 60),
      s('a', 'wordle', '2026-11-18', 40),
      s('a', 'connections', '2026-11-18', 100), // not a league game
      s('z', 'wordle', '2026-11-18', 100),      // not a member
    ];
    const r = pointsRace(scores, ['a', 'b', 'c'], games, '2026-11-16', '2026-11-18', 'day');
    expect(r.xs).toEqual(['2026-11-16', '2026-11-17', '2026-11-18']);
    expect(r.lines).toEqual([
      { userId: 'a', values: [100, 100, 140] },
      { userId: 'b', values: [0, 60, 60] },
    ]);
  });

  it('buckets by week (Monday keys) for all time', () => {
    const scores = [s('a', 'wordle', '2026-11-04', 50), s('a', 'wordle', '2026-11-08', 25), s('a', 'wordle', '2026-11-20', 10)];
    const r = pointsRace(scores, ['a'], games, '2026-11-04', '2026-11-24', 'week');
    expect(r.xs).toEqual(['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23']);
    expect(r.lines[0].values).toEqual([75, 75, 85, 85]);
  });

  it('finds the first scored day among members and league games', () => {
    const scores = [s('a', 'wordle', '2026-03-02', 1), s('z', 'wordle', '2026-01-01', 1), s('a', 'connections', '2026-02-01', 1)];
    expect(firstScoreDay(scores, ['a'], games)).toBe('2026-03-02');
    expect(firstScoreDay([], ['a'], games)).toBeNull();
  });
});
