// Dev-only preview of the celebration screen: /demo?game=maptap  (not included in production builds)
import { useSearchParams } from 'react-router-dom';
import { parseShare } from '@shared/games';
import { scoreAwardKeys } from '../lib/awards';
import type { Score } from '../lib/types';
import { Celebration } from '../components/Celebration';

const SAMPLES: Record<string, string> = {
  maptap: 'www.maptap.gg November 18\n93🏆 87🎉 71😁 99🏆 64🙂\nFinal score: 912',
  krillion: 'Krillion #125\n430 pts',
  wordle: 'Wordle 1,612 2/6\n⬛🟨⬛⬛⬛\n🟩🟩🟩🟩🟩',
  connections: 'Connections\nPuzzle #532\n🟪🟪🟪🟪\n🟦🟦🟦🟦\n🟩🟩🟩🟩\n🟨🟨🟨🟨',
  plane: 'Plane #44 Score: 92',
  yeastimate: 'Yeastimate #12 Score: 95',
  mini: 'I solved the New York Times Mini Crossword in 0:27!',
};

export default function Demo() {
  const [p] = useSearchParams();
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
