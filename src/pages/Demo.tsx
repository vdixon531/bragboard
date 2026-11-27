// Dev-only previews (not included in production builds):
//   /demo?game=maptap            celebration screen
//   /demo?chart=week|month|all   league graph with fake players (&still skips the draw-in, &since=N fakes a league started N days ago)
import { useSearchParams } from 'react-router-dom';
import { parseShare } from '@shared/games';
import { scoreAwardKeys } from '../lib/awards';
import type { Score } from '../lib/types';
import { Celebration } from '../components/Celebration';
import { LineRace } from '../components/LineRace';
import { pointsRace, rankRace } from '../lib/series';
import { RankRace } from '../components/RankRace';
import { addDays, today, weekStart, monthStart } from '../lib/dates';
import type { Profile } from '../lib/types';

const FAKE: Profile[] = [
  { id: 'me', display_name: 'Valmik', avatar: '🐵', color: '#FF6B2C', onboarded: true },
  { id: 'b', display_name: 'Sam', avatar: '🐥', color: '#2F7FE8', onboarded: true },
  { id: 'c', display_name: 'Priya', avatar: '🦊', color: '#19A974', onboarded: true },
  { id: 'd', display_name: 'Jordan', avatar: '🐼', color: '#6C5CE7', onboarded: true },
  { id: 'e', display_name: 'Alex', avatar: '🦈', color: '#0A2340', onboarded: true },
];

function ChartDemo({ period, still, since }: { period: string; still: boolean; since: number | null }) {
  const end = today();
  const periodStart = period === 'week' ? weekStart(end) : period === 'month' ? monthStart(end) : addDays(end, -180);
  const leagueStart = since === null ? periodStart : addDays(end, -since);
  const start = leagueStart > periodStart ? leagueStart : periodStart;
  const scores: Score[] = [];
  let id = 0;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let d = start; d <= end; d = addDays(d, 1)) {
    FAKE.forEach((p, k) => {
      if (rnd() < 0.2 + k * 0.08) return;
      const points = Math.round(30 + rnd() * 60 + (k === 1 ? 10 : 0));
      scores.push({ id: ++id, user_id: p.id, game_id: 'wordle', day: d, score: points, points, display: '', failed: false, puzzle: null, meta: {}, source: 'app', created_at: d });
    });
  }
  const ids = FAKE.map((p) => p.id);
  const profiles = new Map(FAKE.map((p) => [p.id, p]));
  return (
    <div className="page wide" style={{ paddingTop: 24 }}>
      {period === 'all'
        ? <LineRace race={pointsRace(scores, ids, ['wordle'], start, end, 'week')} profiles={profiles} me="me" animate={!still} />
        : <RankRace race={rankRace(scores, ids, ['wordle'], start, end)} profiles={profiles} me="me" animate={!still} />}
    </div>
  );
}

const SAMPLES: Record<string, string> = {
  maptap: 'www.maptap.gg November 18\n93🏆 87🎉 71😁 99🏆 64🙂\nFinal score: 912',
  krillion: 'Krillion #126 🦐\n360\n\n🫧🏮🐟🏮🦑🦑🐟',
  wordle: 'Wordle 1,612 2/6\n⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩',
  connections: 'Connections\nPuzzle #532\n🟪🟪🟪🟪\n🟦🟦🟦🟦\n🟩🟩🟩🟩\n🟨🟨🟨🟨',
  plane: 'Plain Game #026 — ✈️ 1,742 m\n🎯⬜⬜🟧⬜⬜⬜  ⭐ Golden: round 7',
  yeastimate: 'Yeastimate #25 · 1,393\n🟨🔥⬜🟨🟨⬜🔥\nStill Proving',
  mini: 'I solved the New York Times Mini Crossword in 0:27!',
};

export default function Demo() {
  const [p] = useSearchParams();
  if (p.get('chart')) return <ChartDemo period={p.get('chart')!} still={p.has('still')} since={p.get('since') ? Number(p.get('since')) : null} />;
  const game = p.get('game') ?? 'maptap';
  const r = parseShare(SAMPLES[game] ?? SAMPLES.maptap)!;
  const score: Score & { awardKeys: string[] } = {
    id: 1, user_id: 'me', game_id: r.gameId, day: '2026-11-18', score: r.score, points: r.points, display: r.display,
    failed: Boolean(r.failed), puzzle: r.puzzle ?? null, meta: r.meta ?? {}, source: 'app', created_at: new Date().toISOString(), awardKeys: [],
  };
  score.awardKeys = scoreAwardKeys(score);
  return (
    <div className="celebrate-page">
      <Celebration score={score}>
        <div className="rank-list">
          <span className="rank-chip"><strong>#1</strong> of 5 in The Lunch Table →</span>
        </div>
      </Celebration>
    </div>
  );
}
